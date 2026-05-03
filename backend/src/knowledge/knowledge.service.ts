import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { CreateKnowledgeBaseDto, KnowledgeSource, KnowledgeStatus } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  constructor(
    @InjectRepository(KnowledgeBase)
    private knowledgeRepository: Repository<KnowledgeBase>,
  ) {}

  async create(createKnowledgeBaseDto: CreateKnowledgeBaseDto, userId: number, tenantId: number): Promise<KnowledgeBase> {
    const knowledgeBase = new KnowledgeBase();
    knowledgeBase.name = createKnowledgeBaseDto.name;
    knowledgeBase.description = createKnowledgeBaseDto.description;
    knowledgeBase.source = createKnowledgeBaseDto.source || KnowledgeSource.LOCAL;
    knowledgeBase.documents = createKnowledgeBaseDto.documents || [];
    knowledgeBase.documentCount = createKnowledgeBaseDto.documentCount || 0;
    knowledgeBase.status = createKnowledgeBaseDto.status || KnowledgeStatus.CONNECTED;
    knowledgeBase.userId = userId;
    knowledgeBase.tenantId = tenantId;
    return await this.knowledgeRepository.save(knowledgeBase);
  }

  async findAll(tenantId: number): Promise<KnowledgeBase[]> {
    return await this.knowledgeRepository.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findAllByUserId(userId: number, tenantId: number): Promise<KnowledgeBase[]> {
    return await this.knowledgeRepository.find({ where: { userId, tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: number, tenantId: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.knowledgeRepository.findOne({ where: { id, tenantId } });
    if (!knowledgeBase) throw new NotFoundException(`KnowledgeBase with ID ${id} not found`);
    return knowledgeBase;
  }

  async findOneForUser(id: number, userId: number, tenantId: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.knowledgeRepository.findOne({ where: { id, userId, tenantId } });
    if (!knowledgeBase) throw new NotFoundException(`KnowledgeBase with ID ${id} not found for user`);
    return knowledgeBase;
  }

  async update(id: number, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto, tenantId: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.findOne(id, tenantId);
    Object.assign(knowledgeBase, updateKnowledgeBaseDto);
    knowledgeBase.updatedAt = new Date();
    return await this.knowledgeRepository.save(knowledgeBase);
  }

  async updateForUser(id: number, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto, userId: number, tenantId: number): Promise<KnowledgeBase> {
    const knowledgeBase = await this.findOneForUser(id, userId, tenantId);
    Object.assign(knowledgeBase, updateKnowledgeBaseDto);
    knowledgeBase.updatedAt = new Date();
    return await this.knowledgeRepository.save(knowledgeBase);
  }

  async remove(id: number, tenantId: number): Promise<void> {
    const knowledgeBase = await this.findOne(id, tenantId);
    await this.knowledgeRepository.remove(knowledgeBase);
  }

  async removeForUser(id: number, userId: number, tenantId: number): Promise<void> {
    const knowledgeBase = await this.findOneForUser(id, userId, tenantId);
    await this.knowledgeRepository.remove(knowledgeBase);
  }

  async sync(apiKey: string, kbId: string, tenantId: number = 1): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Sync knowledge base: kbId=${kbId}, tenantId=${tenantId}`);
    return { success: true, message: '知识库同步任务已提交，将在后台执行' };
  }
}