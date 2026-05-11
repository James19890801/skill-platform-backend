import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import { CreateKnowledgeBaseDto, KnowledgeSource, KnowledgeStatus } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { ObservabilityService } from '../monitoring/observability.service';
import {
  chunkText,
  extractTextFromDocument,
  rankKnowledgeChunks,
} from './knowledge-pipeline';
import { normalizeUploadedFilename } from './filename';

export interface KnowledgeSourceReference {
  id: string;
  knowledgeBaseId: number;
  knowledgeBaseName: string;
  documentId: number;
  documentName: string;
  chunkId: number;
  chunkIndex: number;
  score: number;
  sectionTitle?: string;
  preview: string;
  content?: string;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly embeddingClient: OpenAI;
  private readonly embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-v4';
  private readonly embeddingBatchSize = positiveIntegerEnv('KNOWLEDGE_EMBEDDING_BATCH_SIZE', 16, 1);
  private readonly maxChunksPerDocument = positiveIntegerEnv('KNOWLEDGE_MAX_CHUNKS_PER_DOCUMENT', 500, 1);
  private readonly maxSearchTopK = positiveIntegerEnv('KNOWLEDGE_MAX_TOP_K', 20, 1);
  private readonly maxSearchChunks = positiveIntegerEnv('KNOWLEDGE_MAX_SEARCH_CHUNKS', 5000, 100);

  constructor(
    @InjectRepository(KnowledgeBase)
    private knowledgeRepository: Repository<KnowledgeBase>,
    @InjectRepository(KnowledgeDocument)
    private documentRepository: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeChunk)
    private chunkRepository: Repository<KnowledgeChunk>,
    private observability: ObservabilityService,
  ) {
    this.embeddingClient = new OpenAI({
      apiKey: process.env.QWEN_API_KEY || '',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 30_000,
      maxRetries: 1,
    });
  }

  async create(createKnowledgeBaseDto: CreateKnowledgeBaseDto, userId: number): Promise<KnowledgeBase> {
    const knowledgeBase = new KnowledgeBase();
    knowledgeBase.name = createKnowledgeBaseDto.name;
    knowledgeBase.description = createKnowledgeBaseDto.description;
    knowledgeBase.source = createKnowledgeBaseDto.source || KnowledgeSource.LOCAL;
    knowledgeBase.documents = (createKnowledgeBaseDto.documents || []).map(normalizeUploadedFilename);
    knowledgeBase.documentCount = createKnowledgeBaseDto.documentCount || 0;
    knowledgeBase.status = createKnowledgeBaseDto.status || KnowledgeStatus.CONNECTED;
    knowledgeBase.userId = userId;

    return await this.knowledgeRepository.save(knowledgeBase);
  }

  async findAll(): Promise<KnowledgeBase[]> {
    const knowledgeBases = await this.knowledgeRepository.find({
      order: { createdAt: 'DESC' },
    });
    return this.attachIndexStats(knowledgeBases);
  }

  async findAllByUserId(userId: number): Promise<KnowledgeBase[]> {
    const knowledgeBases = await this.knowledgeRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return this.attachIndexStats(knowledgeBases);
  }

  async findOne(id: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.knowledgeRepository.findOne({
      where: { id },
    });

    if (!knowledgeBase) {
      throw new NotFoundException(`KnowledgeBase with ID ${id} not found`);
    }

    const [documents, chunkCount] = await Promise.all([
      this.documentRepository.find({
        where: { knowledgeBaseId: id },
        order: { createdAt: 'DESC' },
      }),
      this.chunkRepository.count({ where: { knowledgeBaseId: id } }),
    ]);

    return Object.assign(
      this.normalizeKnowledgeBaseDisplay(knowledgeBase),
      {
        indexedDocuments: documents.map((document) => this.normalizeDocumentDisplay(document)),
        chunkCount,
      },
    );
  }

  async findOneForUser(id: number, userId: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.knowledgeRepository.findOne({
      where: { id, userId },
    });

    if (!knowledgeBase) {
      throw new NotFoundException(`KnowledgeBase with ID ${id} not found for user`);
    }

    return this.normalizeKnowledgeBaseDisplay(knowledgeBase);
  }

  async update(id: number, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto): Promise<KnowledgeBase> {
    const knowledgeBase = await this.findOne(id);

    if (updateKnowledgeBaseDto.documents) {
      updateKnowledgeBaseDto.documents = updateKnowledgeBaseDto.documents.map(normalizeUploadedFilename);
    }
    Object.assign(knowledgeBase, updateKnowledgeBaseDto);
    knowledgeBase.updatedAt = new Date();

    return await this.knowledgeRepository.save(knowledgeBase);
  }

  async updateForUser(id: number, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto, userId: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.findOneForUser(id, userId);

    if (updateKnowledgeBaseDto.documents) {
      updateKnowledgeBaseDto.documents = updateKnowledgeBaseDto.documents.map(normalizeUploadedFilename);
    }
    Object.assign(knowledgeBase, updateKnowledgeBaseDto);
    knowledgeBase.updatedAt = new Date();

    return await this.knowledgeRepository.save(knowledgeBase);
  }

  async remove(id: number): Promise<void> {
    const knowledgeBase = await this.findOne(id);
    await this.chunkRepository.delete({ knowledgeBaseId: id });
    await this.documentRepository.delete({ knowledgeBaseId: id });
    await this.knowledgeRepository.remove(knowledgeBase);
  }

  async removeForUser(id: number, userId: number): Promise<void> {
    const knowledgeBase = await this.findOneForUser(id, userId);
    await this.knowledgeRepository.remove(knowledgeBase);
  }

  async sync(apiKey: string, kbId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Local knowledge base sync requested: kbId=${kbId}, apiKeySet=${Boolean(apiKey)}`);
    return {
      success: true,
      message: '本地知识库已启用，无需同步百炼；请直接上传文档构建索引',
    };
  }

  async uploadDocument(
    knowledgeBaseId: number,
    file: { originalname: string; mimetype?: string; size?: number; buffer: Buffer },
    options: { chunkSize?: number; chunkOverlap?: number } = {},
  ): Promise<KnowledgeDocument> {
    const knowledgeBase = await this.findOne(knowledgeBaseId);
    const displayName = normalizeUploadedFilename(file.originalname);
    const document = await this.documentRepository.save(this.documentRepository.create({
      knowledgeBaseId,
      name: displayName,
      mimeType: file.mimetype,
      size: file.size || file.buffer.length,
      status: 'processing',
      chunkCount: 0,
    }));
    await this.recordKnowledgeEvent('info', 'knowledge.upload.received', `${displayName} 已接收，开始解析`, {
      knowledgeBaseId,
      documentId: document.id,
      fileName: displayName,
      mimeType: file.mimetype,
      size: file.size || file.buffer.length,
    });

    try {
      const text = await extractTextFromDocument(file.buffer, displayName, file.mimetype);
      await this.recordKnowledgeEvent('info', 'knowledge.upload.extracted', `${displayName} 文本解析完成`, {
        knowledgeBaseId,
        documentId: document.id,
        textLength: text.length,
      });
      const allChunks = chunkText(text, {
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap,
        metadata: {
          documentName: displayName,
          mimeType: file.mimetype,
          knowledgeBaseId,
        },
      });
      const chunks = allChunks.slice(0, this.maxChunksPerDocument);
      await this.recordKnowledgeEvent('info', 'knowledge.upload.chunked', `${displayName} 已生成 ${chunks.length} 个切片`, {
        knowledgeBaseId,
        documentId: document.id,
        chunkCount: chunks.length,
        totalChunks: allChunks.length,
        maxChunksPerDocument: this.maxChunksPerDocument,
      });

      if (chunks.length === 0) {
        throw new Error('文档没有可索引文本');
      }

      const embeddings = await this.embedTexts(chunks.map((chunk) => chunk.content));
      await this.chunkRepository.save(chunks.map((chunk, index) => this.chunkRepository.create({
        knowledgeBaseId,
        documentId: document.id,
        chunkIndex: chunk.index,
        content: chunk.content,
        embedding: embeddings[index] || createLocalEmbedding(chunk.content),
        metadata: chunk.metadata,
      })));

      document.status = 'indexed';
      document.textPreview = text.slice(0, 800);
      document.chunkCount = chunks.length;
      document.error = allChunks.length > chunks.length
        ? `文档较大，已索引前 ${chunks.length} 个切片（共 ${allChunks.length} 个）`
        : undefined;
      const savedDocument = await this.documentRepository.save(document);

      knowledgeBase.documents = Array.from(new Set([...(knowledgeBase.documents || []), displayName]));
      knowledgeBase.documentCount = await this.documentRepository.count({ where: { knowledgeBaseId } });
      knowledgeBase.status = KnowledgeStatus.CONNECTED;
      await this.knowledgeRepository.save(knowledgeBase);
      await this.recordKnowledgeEvent('info', 'knowledge.upload.indexed', `${displayName} 已完成索引`, {
        knowledgeBaseId,
        documentId: document.id,
        chunkCount: chunks.length,
      });

      return savedDocument;
    } catch (err) {
      document.status = 'error';
      document.error = err instanceof Error ? err.message : String(err);
      await this.documentRepository.save(document);
      await this.recordKnowledgeEvent('error', 'knowledge.upload.failed', `${displayName} 索引失败`, {
        knowledgeBaseId,
        documentId: document.id,
        fileName: displayName,
        size: file.size || file.buffer.length,
        error: document.error,
      });
      throw err;
    }
  }

  async ingestText(
    knowledgeBaseId: number,
    input: { name: string; content: string; chunkSize?: number; chunkOverlap?: number },
  ): Promise<KnowledgeDocument> {
    return this.uploadDocument(knowledgeBaseId, {
      originalname: input.name,
      mimetype: 'text/plain',
      size: Buffer.byteLength(input.content),
      buffer: Buffer.from(input.content, 'utf8'),
    }, {
      chunkSize: input.chunkSize,
      chunkOverlap: input.chunkOverlap,
    });
  }

  async listDocuments(knowledgeBaseId: number): Promise<KnowledgeDocument[]> {
    await this.findOne(knowledgeBaseId);
    const documents = await this.documentRepository.find({
      where: { knowledgeBaseId },
      order: { createdAt: 'DESC' },
    });
    return documents.map((document) => this.normalizeDocumentDisplay(document));
  }

  async listChunks(
    knowledgeBaseId: number,
    options: { documentId?: number; limit?: number; offset?: number } = {},
  ): Promise<{ items: Array<KnowledgeChunk & { documentName?: string; knowledgeBaseName?: string }>; total: number }> {
    const knowledgeBase = await this.findOne(knowledgeBaseId);
    const where: { knowledgeBaseId: number; documentId?: number } = { knowledgeBaseId };
    if (options.documentId) where.documentId = options.documentId;
    const take = Math.min(Math.max(1, options.limit || 100), 500);
    const skip = Math.max(0, options.offset || 0);
    const [chunks, total] = await this.chunkRepository.findAndCount({
      where,
      order: { documentId: 'ASC', chunkIndex: 'ASC' },
      take,
      skip,
    });
    const documentNames = await this.getDocumentNameMap(chunks.map((chunk) => chunk.documentId));
    return {
      total,
      items: chunks.map((chunk) => Object.assign(chunk, {
        documentName: documentNames.get(chunk.documentId),
        knowledgeBaseName: knowledgeBase.name,
      })),
    };
  }

  async getChunk(knowledgeBaseId: number, chunkId: number): Promise<KnowledgeChunk & { documentName?: string; knowledgeBaseName?: string }> {
    const knowledgeBase = await this.findOne(knowledgeBaseId);
    const chunk = await this.chunkRepository.findOne({ where: { id: chunkId, knowledgeBaseId } });
    if (!chunk) {
      throw new NotFoundException(`KnowledgeChunk with ID ${chunkId} not found`);
    }
    const document = await this.documentRepository.findOne({ where: { id: chunk.documentId } });
    return Object.assign(chunk, {
      documentName: document?.name ? normalizeUploadedFilename(document.name) : undefined,
      knowledgeBaseName: knowledgeBase.name,
    });
  }

  async search(
    knowledgeBaseId: number,
    query: string,
    topK = 5,
  ): Promise<{
    query: string;
    topK: number;
    results: Array<KnowledgeChunk & { score: number }>;
    context: string;
    sources: KnowledgeSourceReference[];
  }> {
    const knowledgeBase = await this.findOne(knowledgeBaseId);
    const normalizedTopK = Math.min(Math.max(1, topK || 5), this.maxSearchTopK);
    const chunks = await this.chunkRepository.find({
      where: { knowledgeBaseId },
      take: this.maxSearchChunks,
      order: { id: 'DESC' },
    });
    if (chunks.length === 0) {
      return { query, topK: normalizedTopK, results: [], context: '', sources: [] };
    }

    const [queryEmbedding] = await this.embedTexts([query]);
    const ranked = rankKnowledgeChunks(chunks, queryEmbedding || createLocalEmbedding(query), normalizedTopK, { queryText: query });
    const sources = await this.buildSourceReferences(ranked, new Map([[knowledgeBase.id, knowledgeBase.name]]));
    const context = ranked
      .map((chunk, index) => {
        const source = sources[index];
        const label = source
          ? `[KB:${source.knowledgeBaseName} | Doc:${source.documentName} | Chunk:${source.chunkIndex + 1} | Source:${source.id}]`
          : `[${index + 1}]`;
        return `${label}\n${chunk.content}`;
      })
      .join('\n\n---\n\n');

    return { query, topK: normalizedTopK, results: ranked, context, sources };
  }

  async searchMany(
    knowledgeBaseIds: number[],
    query: string,
    topK = 5,
  ): Promise<{ context: string; results: Array<KnowledgeChunk & { score: number }>; sources: KnowledgeSourceReference[] }> {
    const ids = knowledgeBaseIds.filter((id) => Number.isInteger(id) && id > 0);
    const results: Array<KnowledgeChunk & { score: number }> = [];
    const sources: KnowledgeSourceReference[] = [];

    const searchResults = await Promise.all(ids.map((id) => this.search(id, query, topK)));
    for (const searchResult of searchResults) {
      results.push(...searchResult.results);
      sources.push(...searchResult.sources);
    }

    const ranked = results
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK));
    const rankedIds = new Set(ranked.map((chunk) => chunk.id));
    const rankedSources = sources
      .filter((source) => rankedIds.has(source.chunkId))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK));

    return {
      results: ranked,
      sources: rankedSources,
      context: ranked
        .map((chunk, index) => {
          const source = rankedSources.find((item) => item.chunkId === chunk.id);
          const label = source
            ? `[知识 ${index + 1} | KB:${source.knowledgeBaseName} | Doc:${source.documentName} | Chunk:${source.chunkIndex + 1} | Source:${source.id}]`
            : `[知识 ${index + 1}]`;
          return `${label}\n${chunk.content}`;
        })
        .join('\n\n---\n\n'),
    };
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    if (!process.env.QWEN_API_KEY) {
      return texts.map(createLocalEmbedding);
    }

    const embeddings: number[][] = [];
    for (let start = 0; start < texts.length; start += this.embeddingBatchSize) {
      const batch = texts.slice(start, start + this.embeddingBatchSize);
      try {
        const response = await this.embeddingClient.embeddings.create({
          model: this.embeddingModel,
          input: batch.map((text) => text.slice(0, 6000)),
        });

        embeddings.push(...response.data.map((item) => item.embedding as number[]));
      } catch (err) {
        this.logger.warn(`Embedding API 不可用，当前批次已降级为本地检索: ${err instanceof Error ? err.message : String(err)}`);
        embeddings.push(...batch.map(createLocalEmbedding));
      }
    }
    return embeddings;
  }

  private async ensureKnowledgeBaseExists(id: number): Promise<void> {
    const exists = await this.knowledgeRepository.exist({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`KnowledgeBase with ID ${id} not found`);
    }
  }

  private normalizeKnowledgeBaseDisplay(knowledgeBase: KnowledgeBase): KnowledgeBase {
    knowledgeBase.documents = (knowledgeBase.documents || []).map(normalizeUploadedFilename);
    return knowledgeBase;
  }

  private normalizeDocumentDisplay(document: KnowledgeDocument): KnowledgeDocument {
    document.name = normalizeUploadedFilename(document.name);
    return document;
  }

  private async attachIndexStats(knowledgeBases: KnowledgeBase[]): Promise<KnowledgeBase[]> {
    if (knowledgeBases.length === 0) return [];
    const ids = knowledgeBases.map((knowledgeBase) => knowledgeBase.id);
    const [documentRows, chunkRows] = await Promise.all([
      this.documentRepository
        .createQueryBuilder('document')
        .select('document.knowledgeBaseId', 'knowledgeBaseId')
        .addSelect('COUNT(document.id)', 'count')
        .where('document.knowledgeBaseId IN (:...ids)', { ids })
        .groupBy('document.knowledgeBaseId')
        .getRawMany(),
      this.chunkRepository
        .createQueryBuilder('chunk')
        .select('chunk.knowledgeBaseId', 'knowledgeBaseId')
        .addSelect('COUNT(chunk.id)', 'count')
        .where('chunk.knowledgeBaseId IN (:...ids)', { ids })
        .groupBy('chunk.knowledgeBaseId')
        .getRawMany(),
    ]);
    const documentCounts = new Map<number, number>(
      documentRows.map((row) => [Number(row.knowledgeBaseId), Number(row.count)]),
    );
    const chunkCounts = new Map<number, number>(
      chunkRows.map((row) => [Number(row.knowledgeBaseId), Number(row.count)]),
    );

    return knowledgeBases.map((knowledgeBase) => {
      const normalized = this.normalizeKnowledgeBaseDisplay(knowledgeBase);
      normalized.documentCount = documentCounts.get(normalized.id) ?? normalized.documentCount ?? 0;
      normalized.chunkCount = chunkCounts.get(normalized.id) ?? 0;
      return normalized;
    });
  }

  private async getDocumentNameMap(documentIds: number[]): Promise<Map<number, string>> {
    const ids = Array.from(new Set(documentIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (ids.length === 0) return new Map();
    const documents = await this.documentRepository
      .createQueryBuilder('document')
      .where('document.id IN (:...ids)', { ids })
      .getMany();
    return new Map(documents.map((document) => [document.id, normalizeUploadedFilename(document.name)]));
  }

  private async buildSourceReferences(
    chunks: Array<KnowledgeChunk & { score: number }>,
    knownKnowledgeBases = new Map<number, string>(),
  ): Promise<KnowledgeSourceReference[]> {
    const documentNames = await this.getDocumentNameMap(chunks.map((chunk) => chunk.documentId));
    const missingKnowledgeBaseIds = Array.from(new Set(
      chunks
        .map((chunk) => chunk.knowledgeBaseId)
        .filter((id) => !knownKnowledgeBases.has(id)),
    ));
    if (missingKnowledgeBaseIds.length > 0) {
      const bases = await this.knowledgeRepository
        .createQueryBuilder('knowledgeBase')
        .where('knowledgeBase.id IN (:...ids)', { ids: missingKnowledgeBaseIds })
        .getMany();
      for (const base of bases) knownKnowledgeBases.set(base.id, base.name);
    }

    return chunks.map((chunk) => {
      const metadata = chunk.metadata || {};
      const documentName = documentNames.get(chunk.documentId)
        || (typeof metadata.documentName === 'string' ? metadata.documentName : `文档 ${chunk.documentId}`);
      const knowledgeBaseName = knownKnowledgeBases.get(chunk.knowledgeBaseId) || `知识库 ${chunk.knowledgeBaseId}`;
      const sectionTitle = typeof metadata.sectionTitle === 'string' ? metadata.sectionTitle : undefined;
      const id = `kb${chunk.knowledgeBaseId}-doc${chunk.documentId}-c${chunk.chunkIndex + 1}`;
      return {
        id,
        knowledgeBaseId: chunk.knowledgeBaseId,
        knowledgeBaseName,
        documentId: chunk.documentId,
        documentName,
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        score: Number(chunk.score.toFixed(4)),
        sectionTitle,
        preview: chunk.content.slice(0, 220),
        content: chunk.content,
      };
    });
  }

  private async recordKnowledgeEvent(
    level: 'info' | 'warn' | 'error',
    category: string,
    message: string,
    details: Record<string, unknown>,
  ) {
    try {
      await this.observability.record({ level, category, message, details });
    } catch {
      // Monitoring must never break the knowledge indexing path.
    }
  }
}

function createLocalEmbedding(text: string, dimensions = 384): number[] {
  const vector = new Array(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter(Boolean);

  for (const token of tokens.length > 0 ? tokens : Array.from(text)) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

function positiveIntegerEnv(name: string, fallback: number, min: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}
