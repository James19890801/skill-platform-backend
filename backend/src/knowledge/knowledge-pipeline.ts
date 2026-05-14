import JSZip from 'jszip';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

export interface ChunkTextOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeTextChunk {
  index: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RankableKnowledgeChunk {
  id: number;
  content: string;
  embedding: number[];
}

export interface RankedKnowledgeChunk extends RankableKnowledgeChunk {
  score: number;
}

export interface InferredProcessMetadata {
  domain?: string;
  processCode?: string;
  processName?: string;
  version?: string;
  status?: string;
  departments?: string[];
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 180;
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|json|yaml|yml|xml|html|htm|log|sql|py|js|ts|tsx|jsx|css)$/i;
const SENTENCE_BOUNDARY = /(?<=[。！？!?；;.!?])\s*|\n+/u;
const QUERY_STOP_TERMS = new Set([
  '怎么',
  '如何',
  '哪些',
  '什么',
  '是否',
  '需要',
  '流程',
  '文档',
  '规定',
  '制度',
  '请问',
  '一下',
  '走',
]);

export function chunkText(text: string, options: ChunkTextOptions = {}): KnowledgeTextChunk[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunkSize = Math.max(80, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const chunkOverlap = Math.min(Math.max(0, options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP), Math.floor(chunkSize / 2));
  const sections = splitIntoSections(normalized);
  const chunks: KnowledgeTextChunk[] = [];

  for (const section of sections) {
    const sectionChunks = chunkSection(section.text, chunkSize, chunkOverlap);
    for (const chunk of sectionChunks) {
      chunks.push({
        index: chunks.length,
        content: chunk.content,
        metadata: {
          ...(options.metadata ?? {}),
          sectionTitle: section.title,
          sectionIndex: section.index,
          start: section.start + chunk.start,
          end: section.start + chunk.end,
          tokenEstimate: Math.ceil(chunk.content.length / 4),
          splitMethod: chunk.method,
        },
      });
    }
  }

  return chunks;
}

export async function extractTextFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType = '',
): Promise<string> {
  const lowerName = filename.toLowerCase();
  const type = mimeType.toLowerCase();

  if (type.includes('pdf') || lowerName.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    return normalizeText(parsed.text);
  }

  if (type.includes('wordprocessingml') || lowerName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value);
  }

  if (type.includes('presentationml') || lowerName.endsWith('.pptx')) {
    return extractPptxText(buffer);
  }

  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls')
  ) {
    return extractWorkbookText(buffer);
  }

  if (type.startsWith('text/') || TEXT_EXTENSIONS.test(lowerName)) {
    return normalizeText(buffer.toString('utf8'));
  }

  return normalizeText(buffer.toString('utf8'));
}

export function rankKnowledgeChunks<T extends RankableKnowledgeChunk>(
  chunks: T[],
  queryEmbedding: number[],
  topK = 5,
  options: { queryText?: string; vectorWeight?: number } = {},
): Array<T & { score: number }> {
  const vectorWeight = clamp(options.vectorWeight ?? 0.78, 0, 1);
  const queryTerms = tokenizeForRetrieval(options.queryText || '');

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: (
        cosineSimilarity(queryEmbedding, chunk.embedding) * vectorWeight
        + lexicalOverlapScore(queryTerms, chunk.content) * (1 - vectorWeight)
      ),
    }))
    .filter((chunk) => Number.isFinite(chunk.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK));
}

export function buildKnowledgeSearchTerms(query: string, maxTerms = 12): string[] {
  const normalized = normalizeText(query).toLowerCase();
  if (!normalized) return [];

  const terms: string[] = [];
  const push = (term: string) => {
    const value = term.trim().toLowerCase();
    if (value.length < 2 || QUERY_STOP_TERMS.has(value)) return;
    if (!terms.includes(value)) terms.push(value);
  };

  for (const match of normalized.matchAll(/[a-z0-9][a-z0-9_.-]{1,}/g)) {
    push(match[0]);
  }

  for (const match of normalized.matchAll(/[\p{Script=Han}]{2,}/gu)) {
    let phrase = match[0];
    for (const stopTerm of QUERY_STOP_TERMS) {
      phrase = phrase.replaceAll(stopTerm, ' ');
    }
    for (const segment of phrase.split(/\s+/).filter((item) => item.length >= 2)) {
      push(segment);
      if (segment.length > 2) {
        for (let i = 0; i < segment.length - 1; i += 1) {
          push(segment.slice(i, i + 2));
        }
      }
    }
  }

  return terms
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .slice(0, Math.max(1, maxTerms));
}

export function inferProcessMetadata(text: string, documentName = ''): InferredProcessMetadata {
  const normalized = normalizeText(text);
  const metadata: InferredProcessMetadata = {};

  metadata.processCode = pickFirst(normalized, [
    /流程编号\s*[:：]\s*([A-Za-z0-9_.-]{2,80})/i,
    /(?:制度|文件|文档)编号\s*[:：]\s*([A-Za-z0-9_.-]{2,80})/i,
  ]);
  metadata.processName = pickFirst(normalized, [
    /流程名称\s*[:：]\s*([^\n\r]{2,120})/i,
    /(?:制度|文件|文档)名称\s*[:：]\s*([^\n\r]{2,120})/i,
  ]);
  metadata.version = pickFirst(normalized, [
    /(?:版本|版次|修订版本)\s*[:：]\s*([A-Za-z]?\d+(?:\.\d+){0,4})/i,
    /(?:版本|版次|修订版本)\s*[:：]\s*([^\n\r]{1,40})/i,
  ]);
  metadata.status = pickFirst(normalized, [
    /(?:当前状态|状态|文件状态)\s*[:：]\s*([^\n\r]{1,40})/i,
  ]);
  metadata.domain = pickFirst(normalized, [
    /(?:归口领域|所属领域|业务领域|流程领域|流程域|业务域|领域)\s*[:：]\s*([^\n\r]{1,80})/i,
  ]);

  const departments = pickFirst(normalized, [
    /(?:适用部门|适用组织|适用范围)\s*[:：]\s*([^\n\r]{2,160})/i,
  ]);
  if (departments) {
    metadata.departments = departments
      .split(/[、,，;；/]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  const baseName = documentName.replace(/\.[^.]+$/, '');
  const firstNamePart = baseName.split(/[-_—｜|]/)[0]?.trim();
  if (!metadata.domain && firstNamePart && /[\u4e00-\u9fff]/u.test(firstNamePart) && firstNamePart.length <= 20) {
    metadata.domain = firstNamePart;
  }
  if (!metadata.version) {
    metadata.version = baseName.match(/\bV\d+(?:\.\d+){0,4}\b/i)?.[0];
  }
  if (!metadata.processName && baseName) {
    const withoutVersion = baseName.replace(/\bV\d+(?:\.\d+){0,4}\b/ig, '').replace(/[-_—｜|]+/g, ' ').trim();
    if (withoutVersion) metadata.processName = withoutVersion.slice(0, 120);
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value)),
  ) as InferredProcessMetadata;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let i = 0; i < length; i += 1) {
    const a = left[i] || 0;
    const b = right[i] || 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const texts: string[] = [];

  for (const slideName of slideNames) {
    const entry = zip.file(slideName);
    if (!entry) continue;

    const xml = await entry.async('string');
    const slideText = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXml(match[1]))
      .filter(Boolean)
      .join('\n');

    if (slideText) {
      texts.push(`### Slide ${texts.length + 1}\n${slideText}`);
    }
  }

  return normalizeText(texts.join('\n\n'));
}

function extractWorkbookText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sections = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    return `### ${sheetName}\n${csv}`;
  });

  return normalizeText(sections.join('\n\n'));
}

function splitIntoSections(text: string): Array<{ index: number; title: string; text: string; start: number }> {
  const lines = text.split('\n');
  const sections: Array<{ index: number; title: string; text: string; start: number }> = [];
  let currentTitle = '全文';
  let currentLines: string[] = [];
  let currentStart = 0;
  let cursor = 0;

  const flush = () => {
    const body = currentLines.join('\n').trim();
    if (!body) return;
    sections.push({
      index: sections.length,
      title: currentTitle,
      text: body,
      start: currentStart,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const heading = parseHeading(trimmed);
    if (heading && currentLines.length > 0) {
      flush();
      currentTitle = heading;
      currentLines = [line];
      currentStart = cursor;
    } else {
      if (heading) currentTitle = heading;
      if (currentLines.length === 0) currentStart = cursor;
      currentLines.push(line);
    }
    cursor += line.length + 1;
  }

  flush();
  return sections.length > 0 ? sections : [{ index: 0, title: '全文', text, start: 0 }];
}

function parseHeading(line: string): string | null {
  if (!line) return null;
  const markdown = line.match(/^#{1,6}\s+(.{1,120})$/);
  if (markdown) return markdown[1].trim();
  if (/^(第[一二三四五六七八九十百千万0-9]+[章节条部分]|[一二三四五六七八九十]+、|\d+(\.\d+)*[、.])/.test(line) && line.length <= 120) {
    return line;
  }
  return null;
}

function chunkSection(
  sectionText: string,
  chunkSize: number,
  chunkOverlap: number,
): Array<{ content: string; start: number; end: number; method: string }> {
  const blocks = splitBlocks(sectionText, chunkSize);
  const chunks: Array<{ content: string; start: number; end: number; method: string }> = [];
  let current = '';
  let currentStart = 0;

  for (const block of blocks) {
    const separator = current ? '\n\n' : '';
    if (current && current.length + separator.length + block.content.length > chunkSize) {
      const content = current.trim();
      if (content) {
        chunks.push({
          content,
          start: currentStart,
          end: currentStart + current.length,
          method: block.method,
        });
      }

      const overlap = buildOverlap(current, chunkOverlap);
      current = overlap ? `${overlap}\n\n${block.content}` : block.content;
      currentStart = overlap ? Math.max(block.start - overlap.length, 0) : block.start;
    } else {
      if (!current) currentStart = block.start;
      current = `${current}${separator}${block.content}`;
    }
  }

  if (current.trim()) {
    chunks.push({
      content: current.trim(),
      start: currentStart,
      end: currentStart + current.length,
      method: 'section',
    });
  }

  return chunks;
}

function splitBlocks(text: string, chunkSize: number): Array<{ content: string; start: number; method: string }> {
  const blocks: Array<{ content: string; start: number; method: string }> = [];
  const paragraphRegex = /\S[\s\S]*?(?=\n{2,}|$)/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphRegex.exec(text)) !== null) {
    const paragraph = match[0].trim();
    if (!paragraph) continue;

    const start = match.index + match[0].indexOf(paragraph);
    if (paragraph.length <= chunkSize) {
      blocks.push({ content: paragraph, start, method: 'paragraph' });
      continue;
    }

    for (const part of splitLongBlock(paragraph, chunkSize)) {
      blocks.push({ content: part.content, start: start + part.start, method: part.method });
    }
  }

  return blocks;
}

function splitLongBlock(text: string, chunkSize: number): Array<{ content: string; start: number; method: string }> {
  const sentences = text
    .split(SENTENCE_BOUNDARY)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    const parts: Array<{ content: string; start: number; method: string }> = [];
    let current = '';
    let currentStart = 0;
    let cursor = 0;

    for (const sentence of sentences) {
      const sentenceStart = text.indexOf(sentence, cursor);
      cursor = sentenceStart >= 0 ? sentenceStart + sentence.length : cursor;
      if (current && current.length + sentence.length + 1 > chunkSize) {
        parts.push({ content: current.trim(), start: currentStart, method: 'sentence' });
        current = sentence;
        currentStart = Math.max(sentenceStart, 0);
      } else {
        if (!current) currentStart = Math.max(sentenceStart, 0);
        current = current ? `${current}${sentence}` : sentence;
      }
    }
    if (current.trim()) parts.push({ content: current.trim(), start: currentStart, method: 'sentence' });
    return parts;
  }

  const parts: Array<{ content: string; start: number; method: string }> = [];
  let start = 0;
  while (start < text.length) {
    const targetEnd = Math.min(start + chunkSize, text.length);
    const end = findChunkEnd(text, start, targetEnd, chunkSize);
    parts.push({ content: text.slice(start, end).trim(), start, method: 'recursive' });
    if (end >= text.length) break;
    start = end;
  }
  return parts;
}

function findChunkEnd(text: string, start: number, targetEnd: number, chunkSize: number): number {
  if (targetEnd >= text.length) return text.length;

  const windowStart = Math.max(start + Math.floor(chunkSize * 0.55), start);
  const candidates = ['\n\n', '\n', '。', '！', '？', '；', ';', '.', ',', ' '];

  for (const separator of candidates) {
    const index = text.lastIndexOf(separator, targetEnd);
    if (index >= windowStart) {
      return index + separator.length;
    }
  }

  return targetEnd;
}

function buildOverlap(content: string, maxLength: number): string {
  if (maxLength <= 0 || content.length <= maxLength) return maxLength > 0 ? content : '';
  const tail = content.slice(-maxLength);
  const paragraphIndex = tail.indexOf('\n\n');
  if (paragraphIndex > 0 && paragraphIndex < tail.length - 20) {
    return tail.slice(paragraphIndex + 2).trim();
  }
  const sentenceIndex = Math.max(
    tail.lastIndexOf('。'),
    tail.lastIndexOf('！'),
    tail.lastIndexOf('？'),
    tail.lastIndexOf('.'),
    tail.lastIndexOf(';'),
  );
  if (sentenceIndex > 10 && sentenceIndex < tail.length - 10) {
    return tail.slice(sentenceIndex + 1).trim();
  }
  return tail.trim();
}

function tokenizeForRetrieval(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((token) => token.length >= 2);
  const chars = Array.from(text.replace(/\s+/g, '')).filter((char) => /\p{Letter}|\p{Number}/u.test(char));
  return new Set([...words, ...chars]);
}

function pickFirst(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value.replace(/[。；;，,]+$/g, '').trim();
  }
  return undefined;
}

function lexicalOverlapScore(queryTerms: Set<string>, content: string): number {
  if (queryTerms.size === 0) return 0;
  const contentTerms = tokenizeForRetrieval(content);
  if (contentTerms.size === 0) return 0;
  let overlap = 0;
  for (const term of queryTerms) {
    if (contentTerms.has(term)) overlap += 1;
  }
  return overlap / Math.sqrt(queryTerms.size * contentTerms.size);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
