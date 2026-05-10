import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { KnowledgeChunk } from '../entities/knowledge-chunk.entity';
import { CreateKnowledgeBaseDto, KnowledgeSource, KnowledgeStatus } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import {
  chunkText,
  extractTextFromDocument,
  rankKnowledgeChunks,
} from './knowledge-pipeline';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly embeddingClient: OpenAI;
  private readonly embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-v4';

  constructor(
    @InjectRepository(KnowledgeBase)
    private knowledgeRepository: Repository<KnowledgeBase>,
    @InjectRepository(KnowledgeDocument)
    private documentRepository: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeChunk)
    private chunkRepository: Repository<KnowledgeChunk>,
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
    knowledgeBase.documents = createKnowledgeBaseDto.documents || [];
    knowledgeBase.documentCount = createKnowledgeBaseDto.documentCount || 0;
    knowledgeBase.status = createKnowledgeBaseDto.status || KnowledgeStatus.CONNECTED;
    knowledgeBase.userId = userId;

    return await this.knowledgeRepository.save(knowledgeBase);
  }

  async findAll(): Promise<KnowledgeBase[]> {
    return await this.knowledgeRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findAllByUserId(userId: number): Promise<KnowledgeBase[]> {
    return await this.knowledgeRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
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

    return Object.assign(knowledgeBase, { indexedDocuments: documents, chunkCount });
  }

  async findOneForUser(id: number, userId: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.knowledgeRepository.findOne({
      where: { id, userId },
    });

    if (!knowledgeBase) {
      throw new NotFoundException(`KnowledgeBase with ID ${id} not found for user`);
    }

    return knowledgeBase;
  }

  async update(id: number, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto): Promise<KnowledgeBase> {
    const knowledgeBase = await this.findOne(id);

    Object.assign(knowledgeBase, updateKnowledgeBaseDto);
    knowledgeBase.updatedAt = new Date();

    return await this.knowledgeRepository.save(knowledgeBase);
  }

  async updateForUser(id: number, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto, userId: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.findOneForUser(id, userId);

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
    const document = await this.documentRepository.save(this.documentRepository.create({
      knowledgeBaseId,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size || file.buffer.length,
      status: 'processing',
      chunkCount: 0,
    }));

    try {
      const text = await extractTextFromDocument(file.buffer, file.originalname, file.mimetype);
      const chunks = chunkText(text, {
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap,
        metadata: {
          documentName: file.originalname,
          mimeType: file.mimetype,
          knowledgeBaseId,
        },
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
      document.error = undefined;
      const savedDocument = await this.documentRepository.save(document);

      knowledgeBase.documents = Array.from(new Set([...(knowledgeBase.documents || []), file.originalname]));
      knowledgeBase.documentCount = await this.documentRepository.count({ where: { knowledgeBaseId } });
      knowledgeBase.status = KnowledgeStatus.CONNECTED;
      await this.knowledgeRepository.save(knowledgeBase);

      return savedDocument;
    } catch (err) {
      document.status = 'error';
      document.error = err instanceof Error ? err.message : String(err);
      await this.documentRepository.save(document);
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
    return this.documentRepository.find({
      where: { knowledgeBaseId },
      order: { createdAt: 'DESC' },
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
  }> {
    await this.findOne(knowledgeBaseId);
    const chunks = await this.chunkRepository.find({ where: { knowledgeBaseId } });
    if (chunks.length === 0) {
      return { query, topK, results: [], context: '' };
    }

    const [queryEmbedding] = await this.embedTexts([query]);
    const ranked = rankKnowledgeChunks(chunks, queryEmbedding || createLocalEmbedding(query), topK);
    const context = ranked
      .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
      .join('\n\n---\n\n');

    return { query, topK, results: ranked, context };
  }

  async searchMany(
    knowledgeBaseIds: number[],
    query: string,
    topK = 5,
  ): Promise<{ context: string; results: Array<KnowledgeChunk & { score: number }> }> {
    const ids = knowledgeBaseIds.filter((id) => Number.isInteger(id) && id > 0);
    const results: Array<KnowledgeChunk & { score: number }> = [];

    for (const id of ids) {
      const searchResult = await this.search(id, query, topK);
      results.push(...searchResult.results);
    }

    const ranked = results
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK));

    return {
      results: ranked,
      context: ranked
        .map((chunk, index) => `[知识 ${index + 1}] ${chunk.content}`)
        .join('\n\n---\n\n'),
    };
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    if (!process.env.QWEN_API_KEY) {
      return texts.map(createLocalEmbedding);
    }

    try {
      const response = await this.embeddingClient.embeddings.create({
        model: this.embeddingModel,
        input: texts.map((text) => text.slice(0, 6000)),
      });

      return response.data.map((item) => item.embedding as number[]);
    } catch (err) {
      this.logger.warn(`Embedding API 不可用，已降级为本地检索: ${err instanceof Error ? err.message : String(err)}`);
      return texts.map(createLocalEmbedding);
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
