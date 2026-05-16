import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'path';
import { LlmService } from '../llm/llm.service';
import { buildKnowledgeSearchTerms } from '../knowledge/knowledge-pipeline';

export interface ProductWikiDocument {
  id: string;
  path: string;
  absolutePath: string;
  title: string;
  description: string;
  kind: string;
  size: number;
  mtimeMs: number;
  headings: string[];
  symbols: string[];
  routes: string[];
  content: string;
}

export interface ProductWikiIndex {
  roots: string[];
  signature: string;
  indexedAt: string;
  documentCount: number;
  totalBytes: number;
  documents: ProductWikiDocument[];
}

export interface ProductWikiSource {
  id: string;
  path: string;
  title: string;
  kind: string;
  score: number;
  sectionTitle?: string;
  preview: string;
  content?: string;
}

export interface ProductWikiSearchResult {
  query: string;
  context: string;
  sources: ProductWikiSource[];
  index: {
    roots: string[];
    indexedAt: string;
    documentCount: number;
    totalBytes: number;
  };
}

export interface ProductWikiAskResult extends ProductWikiSearchResult {
  answer: string;
  degraded?: boolean;
}

export interface ProductWikiSearchOptions {
  topK?: number;
  maxDocuments?: number;
}

interface ProductWikiFileEntry {
  absolutePath: string;
  root: string;
  path: string;
  size: number;
  mtimeMs: number;
}

interface RankedProductWikiDocument {
  document: ProductWikiDocument;
  score: number;
}

interface ProductWikiChunkCandidate {
  source: ProductWikiSource;
  score: number;
}

const DEFAULT_MAX_FILES = 800;
const DEFAULT_MAX_FILE_CHARS = 90_000;
const DEFAULT_TOP_K = 6;
const DEFAULT_MAX_DOCUMENTS = 8;
const EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vite',
  'coverage',
  'db-backups',
  'dist',
  'node_modules',
  'outputs',
  'reports',
  'build',
]);
const INCLUDED_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.mjs',
  '.py',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

@Injectable()
export class ProductWikiService {
  private readonly logger = new Logger(ProductWikiService.name);
  private indexCache: ProductWikiIndex | null = null;
  private indexPromise: Promise<ProductWikiIndex> | null = null;

  constructor(@Optional() private readonly llmService?: LlmService) {}

  async getIndex(force = false): Promise<ProductWikiIndex> {
    if (this.indexPromise) return this.indexPromise;

    this.indexPromise = this.buildIndex(force);
    try {
      return await this.indexPromise;
    } finally {
      this.indexPromise = null;
    }
  }

  async getOverview() {
    const index = await this.getIndex();
    return {
      roots: index.roots,
      indexedAt: index.indexedAt,
      documentCount: index.documentCount,
      totalBytes: index.totalBytes,
      documents: index.documents.slice(0, 80).map((document) => ({
        id: document.id,
        path: document.path,
        title: document.title,
        description: document.description,
        kind: document.kind,
        routes: document.routes,
        symbols: document.symbols.slice(0, 8),
      })),
    };
  }

  async search(query: string, options: ProductWikiSearchOptions = {}): Promise<ProductWikiSearchResult> {
    const trimmedQuery = query.trim();
    const index = await this.getIndex();
    const topK = clampInteger(options.topK, 1, 12, DEFAULT_TOP_K);
    const maxDocuments = clampInteger(options.maxDocuments, 1, 20, DEFAULT_MAX_DOCUMENTS);
    const terms = buildProductWikiSearchTerms(trimmedQuery);
    const rankedDocuments = this.rankDocuments(index.documents, trimmedQuery, terms);
    const selectedDocuments = pickSelectedDocuments(rankedDocuments, maxDocuments);
    const candidates = selectedDocuments.flatMap((ranked) =>
      this.buildChunkCandidates(ranked, terms, trimmedQuery),
    );

    const selectedSources = candidates
      .sort((left, right) => right.score - left.score || left.source.path.localeCompare(right.source.path))
      .slice(0, topK)
      .map(({ source }) => source);

    return {
      query: trimmedQuery,
      sources: selectedSources,
      context: selectedSources.map((source, index) => {
        const label = `[Product Wiki ${index + 1} | ${source.path}${source.sectionTitle ? ` | ${source.sectionTitle}` : ''} | Source:${source.id}]`;
        return `${label}\n${source.content || source.preview}`;
      }).join('\n\n---\n\n'),
      index: {
        roots: index.roots,
        indexedAt: index.indexedAt,
        documentCount: index.documentCount,
        totalBytes: index.totalBytes,
      },
    };
  }

  async ask(question: string, options: ProductWikiSearchOptions & { model?: string } = {}): Promise<ProductWikiAskResult> {
    const searchResult = await this.search(question, options);
    if (!searchResult.context || !this.llmService) {
      return {
        ...searchResult,
        answer: buildExtractiveProductWikiAnswer(question, searchResult.sources),
        degraded: true,
      };
    }

    try {
      const binding = await this.llmService.getModelClient(options.model);
      const completion = await binding.client.chat.completions.create({
        model: binding.model,
        messages: this.buildAnswerMessages(question, searchResult.context),
        temperature: 0.2,
        max_tokens: 1400,
      } as any);

      return {
        ...searchResult,
        answer: completion.choices[0]?.message?.content?.trim() || buildExtractiveProductWikiAnswer(question, searchResult.sources),
      };
    } catch (err) {
      this.logger.warn(`Product wiki answer degraded: ${err instanceof Error ? err.message : String(err)}`);
      return {
        ...searchResult,
        answer: buildExtractiveProductWikiAnswer(question, searchResult.sources),
        degraded: true,
      };
    }
  }

  async streamAsk(
    question: string,
    onEvent: (event: Record<string, unknown>) => void,
    options: ProductWikiSearchOptions & { model?: string } = {},
  ): Promise<string> {
    const searchResult = await this.search(question, options);
    onEvent({ type: 'sources', sources: searchResult.sources, index: searchResult.index });

    if (!searchResult.context || !this.llmService) {
      const answer = buildExtractiveProductWikiAnswer(question, searchResult.sources);
      onEvent({ type: 'content', content: answer });
      onEvent({ type: 'done' });
      return answer;
    }

    try {
      const binding = await this.llmService.getModelClient(options.model);
      const stream = await binding.client.chat.completions.create({
        model: binding.model,
        messages: this.buildAnswerMessages(question, searchResult.context),
        temperature: 0.2,
        max_tokens: 1400,
        stream: true,
      } as any);

      let answer = '';
      for await (const chunk of stream as any) {
        const content = chunk?.choices?.[0]?.delta?.content;
        if (!content) continue;
        answer += content;
        onEvent({ type: 'content', content });
      }
      onEvent({ type: 'done' });
      return answer;
    } catch (err) {
      this.logger.warn(`Product wiki stream degraded: ${err instanceof Error ? err.message : String(err)}`);
      const answer = buildExtractiveProductWikiAnswer(question, searchResult.sources);
      onEvent({ type: 'content', content: answer });
      onEvent({ type: 'done', degraded: true });
      return answer;
    }
  }

  private async buildIndex(force: boolean): Promise<ProductWikiIndex> {
    const now = Date.now();
    const ttlMs = getPositiveIntegerEnv('PRODUCT_WIKI_INDEX_TTL_MS', 0);
    if (!force && ttlMs > 0 && this.indexCache && now - Date.parse(this.indexCache.indexedAt) < ttlMs) {
      return this.indexCache;
    }

    const roots = resolveWikiRoots();
    const entries = collectProductWikiFiles(roots);
    const signature = hashText(entries.map((entry) => `${entry.path}:${entry.size}:${entry.mtimeMs}`).join('\n'));
    if (!force && this.indexCache?.signature === signature) {
      return this.indexCache;
    }

    const documents = entries
      .map((entry) => this.readDocument(entry))
      .filter((document): document is ProductWikiDocument => Boolean(document));
    const index: ProductWikiIndex = {
      roots,
      signature,
      indexedAt: new Date().toISOString(),
      documentCount: documents.length,
      totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
      documents,
    };
    this.indexCache = index;
    return index;
  }

  private readDocument(entry: ProductWikiFileEntry): ProductWikiDocument | null {
    try {
      const maxChars = getPositiveIntegerEnv('PRODUCT_WIKI_MAX_FILE_CHARS', DEFAULT_MAX_FILE_CHARS);
      const raw = readFileSync(entry.absolutePath, 'utf8').replace(/\u0000/g, '');
      const content = raw.length > maxChars
        ? `${raw.slice(0, maxChars)}\n\n[Product wiki note: file truncated at ${maxChars} chars]`
        : raw;
      const headings = extractMarkdownHeadings(content);
      const routes = extractHttpRoutes(content);
      const symbols = extractExportedSymbols(content);
      const title = headings[0] || humanizeFileName(basename(entry.path));
      const description = extractDescription(content, entry.path, { headings, routes, symbols });
      return {
        id: hashText(entry.path).slice(0, 12),
        path: entry.path,
        absolutePath: entry.absolutePath,
        title,
        description,
        kind: inferDocumentKind(entry.path, content),
        size: entry.size,
        mtimeMs: entry.mtimeMs,
        headings,
        routes,
        symbols,
        content,
      };
    } catch (err) {
      this.logger.warn(`Product wiki skipped ${entry.path}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private rankDocuments(
    documents: ProductWikiDocument[],
    query: string,
    terms: string[],
  ): RankedProductWikiDocument[] {
    const normalizedQuery = query.toLowerCase();
    return documents
      .map((document) => {
        const weightedDescription = [
          document.title,
          document.description,
          document.path,
          document.headings.join('\n'),
          document.routes.join('\n'),
          document.symbols.join('\n'),
        ].join('\n');
        let score = scoreText(weightedDescription, terms) * 4 + scoreText(document.content.slice(0, 12_000), terms);
        if (isReadmeLike(document.path)) score += scoreText(document.description, terms) * 3 + 0.4;
        if (document.kind === 'api') score += /接口|api|endpoint|route|请求|调用/i.test(normalizedQuery) ? 4 : 0;
        if (document.kind === 'frontend') score += /页面|前端|浮标|按钮|组件|ui|入口/i.test(normalizedQuery) ? 2 : 0;
        return { document, score };
      })
      .sort((left, right) => right.score - left.score || documentPriority(left.document.path) - documentPriority(right.document.path));
  }

  private buildChunkCandidates(
    ranked: RankedProductWikiDocument,
    terms: string[],
    query: string,
  ): ProductWikiChunkCandidate[] {
    const chunks = splitDocumentIntoChunks(ranked.document);
    return chunks.map((chunk, index) => {
      const chunkScore = scoreText(`${chunk.title}\n${chunk.content}`, terms) * 3 + ranked.score * 0.24 - index * 0.02;
      const content = [
        ranked.document.description ? `摘要：${ranked.document.description}` : '',
        ranked.document.routes.length ? `接口：${ranked.document.routes.join('；')}` : '',
        ranked.document.symbols.length ? `关键对象：${ranked.document.symbols.slice(0, 10).join('；')}` : '',
        chunk.content,
      ].filter(Boolean).join('\n');
      return {
        score: chunkScore || scoreText(query, buildProductWikiSearchTerms(content)),
        source: {
          id: `${ranked.document.id}-c${index + 1}`,
          path: ranked.document.path,
          title: ranked.document.title,
          kind: ranked.document.kind,
          sectionTitle: chunk.title,
          score: Number(Math.max(chunkScore, ranked.score).toFixed(4)),
          preview: compactWhitespace(content).slice(0, 260),
          content,
        },
      };
    });
  }

  private buildAnswerMessages(question: string, context: string) {
    return [
      {
        role: 'system' as const,
        content: [
          '你是这个产品的内置百科智能体，只回答与当前产品功能、接口、实现细节、部署和使用方式相关的问题。',
          '你的底层材料是 Product Wiki 检索上下文。优先依据上下文回答；材料不足时直接说明缺口，不要编造。',
          '回答要短而准确。涉及实现位置、接口或配置时，引用 Source 编号或文件路径。',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: `用户问题：${question}\n\nProduct Wiki 检索上下文：\n${context}`,
      },
    ];
  }
}

function resolveWikiRoots(): string[] {
  const configured = (process.env.PRODUCT_WIKI_ROOTS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => isAbsolute(item) ? item : resolve(process.cwd(), item));

  const candidates = configured.length > 0
    ? configured
    : [
      resolve(process.cwd(), 'product-wiki-source'),
      resolve(process.cwd(), '..', 'product-wiki-source'),
      resolve(process.cwd(), '..'),
      resolve(process.cwd()),
    ];

  const roots: string[] = [];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const stat = statSync(candidate);
      if (!stat.isDirectory()) continue;
      if (!roots.includes(candidate)) roots.push(candidate);
    } catch {
      // ignore unreadable roots
    }
  }
  return roots.slice(0, 8);
}

function collectProductWikiFiles(roots: string[]): ProductWikiFileEntry[] {
  const maxFiles = getPositiveIntegerEnv('PRODUCT_WIKI_MAX_FILES', DEFAULT_MAX_FILES);
  const entries: ProductWikiFileEntry[] = [];
  for (const root of roots) {
    walkWikiRoot(root, root, entries, maxFiles);
    if (entries.length >= maxFiles) break;
  }
  return entries
    .sort((left, right) => documentPriority(left.path) - documentPriority(right.path) || left.path.localeCompare(right.path))
    .slice(0, maxFiles);
}

function walkWikiRoot(root: string, current: string, entries: ProductWikiFileEntry[], maxFiles: number) {
  if (entries.length >= maxFiles) return;
  let dirents;
  try {
    dirents = readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }

  for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entries.length >= maxFiles) return;
    const absolutePath = join(current, dirent.name);
    const relPath = normalizePath(relative(root, absolutePath));
    if (!relPath || shouldExcludePath(relPath, dirent.name)) continue;

    if (dirent.isDirectory()) {
      walkWikiRoot(root, absolutePath, entries, maxFiles);
      continue;
    }
    if (!dirent.isFile()) continue;
    const extension = extname(dirent.name).toLowerCase();
    if (!INCLUDED_EXTENSIONS.has(extension)) continue;
    if (shouldExcludeFile(relPath)) continue;

    try {
      const stat = statSync(absolutePath);
      entries.push({
        absolutePath,
        root,
        path: relPath,
        size: stat.size,
        mtimeMs: Math.floor(stat.mtimeMs),
      });
    } catch {
      // ignore unreadable files
    }
  }
}

function shouldExcludePath(path: string, name: string): boolean {
  if (name.startsWith('.') && name !== '.env.example') return true;
  const segments = path.split('/');
  return segments.some((segment) => EXCLUDED_DIRS.has(segment));
}

function shouldExcludeFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('package-lock.json')
    || lower.endsWith('database.sqlite')
    || lower.endsWith('.sqlite')
    || lower.includes('/db-backups/')
    || lower.includes('/reports/')
    || lower.includes('/outputs/');
}

function pickSelectedDocuments(rankedDocuments: RankedProductWikiDocument[], maxDocuments: number) {
  const positive = rankedDocuments.filter((item) => item.score > 0);
  return (positive.length > 0 ? positive : rankedDocuments).slice(0, maxDocuments);
}

function buildProductWikiSearchTerms(query: string): string[] {
  const terms = buildKnowledgeSearchTerms(query, 18);
  const lower = query.toLowerCase();
  for (const match of lower.matchAll(/[a-z0-9][a-z0-9_.:/-]{1,}/g)) {
    if (!terms.includes(match[0])) terms.push(match[0]);
  }
  return terms.slice(0, 24);
}

function scoreText(text: string, terms: string[]): number {
  if (!text || terms.length === 0) return 0;
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => {
    const normalized = term.toLowerCase();
    if (!normalized || !lower.includes(normalized)) return score;
    const matches = lower.split(normalized).length - 1;
    return score + Math.min(matches, 5) * (1.6 + Math.min(normalized.length, 10) / 3);
  }, 0);
}

function splitDocumentIntoChunks(document: ProductWikiDocument): Array<{ title?: string; content: string }> {
  const chunks: Array<{ title?: string; content: string }> = [];
  const sections = splitMarkdownSections(document.content);
  const maxChunkChars = 3600;
  for (const section of sections.length > 0 ? sections : [{ title: document.title, content: document.content }]) {
    const content = section.content.trim();
    if (!content) continue;
    for (let start = 0; start < content.length; start += maxChunkChars) {
      chunks.push({
        title: section.title,
        content: content.slice(start, start + maxChunkChars),
      });
      if (chunks.length >= 8) return chunks;
    }
  }
  return chunks.length > 0 ? chunks : [{ title: document.title, content: document.content.slice(0, maxChunkChars) }];
}

function splitMarkdownSections(content: string): Array<{ title?: string; content: string }> {
  const lines = content.split(/\r?\n/);
  const sections: Array<{ title?: string; content: string[] }> = [];
  let current: { title?: string; content: string[] } = { content: [] };

  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.+?)\s*$/);
    if (heading && current.content.join('\n').trim()) {
      sections.push(current);
      current = { title: heading[1].trim(), content: [line] };
      continue;
    }
    if (heading && !current.title) {
      current.title = heading[1].trim();
    }
    current.content.push(line);
  }
  if (current.content.join('\n').trim()) sections.push(current);
  return sections.map((section) => ({ title: section.title, content: section.content.join('\n') }));
}

function extractMarkdownHeadings(content: string): string[] {
  return Array.from(content.matchAll(/^#{1,4}\s+(.+?)\s*$/gm))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 24);
}

function extractDescription(
  content: string,
  path: string,
  metadata: { headings: string[]; routes: string[]; symbols: string[] },
): string {
  const extension = extname(path).toLowerCase();
  if (['.md', '.mdx', '.txt'].includes(extension)) {
    const withoutHeadings = content
      .replace(/^#{1,6}\s+.+$/gm, '')
      .split(/\n{2,}/)
      .map((part) => compactWhitespace(part.replace(/```[\s\S]*?```/g, '')))
      .find((part) => part.length >= 12);
    if (withoutHeadings) return withoutHeadings.slice(0, 520);
  }

  const topComment = content.match(/^\s*\/\*\*?([\s\S]{20,900}?)\*\//)?.[1]
    || content.match(/^\s*(?:(?:\/\/|#)\s*.+\n){2,12}/)?.[0];
  if (topComment) {
    return compactWhitespace(topComment.replace(/^\s*(?:\*|\/\/|#)\s?/gm, '')).slice(0, 520);
  }

  const parts = [
    metadata.routes.length ? `接口 ${metadata.routes.slice(0, 8).join('，')}` : '',
    metadata.symbols.length ? `代码对象 ${metadata.symbols.slice(0, 10).join('，')}` : '',
    metadata.headings.length ? `章节 ${metadata.headings.slice(0, 8).join('，')}` : '',
  ].filter(Boolean);
  return parts.join('；') || compactWhitespace(content).slice(0, 520);
}

function extractHttpRoutes(content: string): string[] {
  const controllerPrefix = content.match(/@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/)?.[1] || '';
  const routes = new Set<string>();
  const decorator = /@(Get|Post|Put|Delete|Patch)\(\s*(?:['"`]([^'"`]*)['"`])?/g;
  let match: RegExpExecArray | null;
  while ((match = decorator.exec(content)) !== null) {
    routes.add(`${match[1].toUpperCase()} ${joinRouteParts(controllerPrefix, match[2] || '')}`);
  }
  return Array.from(routes).slice(0, 40);
}

function extractExportedSymbols(content: string): string[] {
  const symbols = new Set<string>();
  const regexes = [
    /export\s+(?:default\s+)?(?:class|function|interface|type|const|let|var|enum)\s+([A-Za-z0-9_]+)/g,
    /class\s+([A-Za-z0-9_]+)(?:\s+extends|\s+implements|\s*\{)/g,
    /const\s+([A-Za-z0-9_]+)\s*:\s*React\.FC/g,
  ];
  for (const regex of regexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      symbols.add(match[1]);
    }
  }
  return Array.from(symbols).slice(0, 60);
}

function inferDocumentKind(path: string, content: string): string {
  const lower = path.toLowerCase();
  if (extractHttpRoutes(content).length > 0 || lower.includes('/controller')) return 'api';
  if (lower.endsWith('.md') || lower.includes('/docs/')) return 'docs';
  if (lower.includes('/frontend/') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) return 'frontend';
  if (lower.includes('/backend/') || lower.includes('/src/') && lower.endsWith('.ts')) return 'backend';
  if (lower.includes('/agent-runtime/') || lower.endsWith('.py')) return 'runtime';
  if (lower.endsWith('.json') || lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'config';
  return 'source';
}

function joinRouteParts(prefix: string, route: string): string {
  const parts = [prefix, route]
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${parts.join('/')}`.replace(/\/+/g, '/');
}

function isReadmeLike(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('readme.md') || lower.includes('/docs/') || lower.startsWith('docs/');
}

function documentPriority(path: string): number {
  const lower = path.toLowerCase();
  if (lower.endsWith('readme.md') || lower.includes('quick_start') || lower.includes('deployment')) return 0;
  if (lower.startsWith('docs/')) return 1;
  if (lower.includes('/controller') || lower.includes('/services/api')) return 2;
  if (lower.includes('/pages/') || lower.includes('/components/')) return 3;
  if (lower.includes('/src/')) return 4;
  return 5;
}

function buildExtractiveProductWikiAnswer(question: string, sources: ProductWikiSource[]): string {
  if (sources.length === 0) {
    return `我还没有在产品 wiki 里找到能回答「${question}」的材料。可以先确认发布包里是否包含 docs、README 或源码目录。`;
  }
  const lines = sources.slice(0, 4).map((source, index) =>
    `${index + 1}. ${source.title}（${source.path}）：${source.preview}`,
  );
  return [
    `我先从产品 wiki 找到 ${sources.length} 条相关材料：`,
    ...lines,
    '当前模型回答能力暂不可用，上面是可用于继续回答的检索依据。',
  ].join('\n');
}

function humanizeFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function hashText(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
