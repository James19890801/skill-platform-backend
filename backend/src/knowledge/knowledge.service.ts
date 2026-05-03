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

    return knowledgeBase;
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
    await this.knowledgeRepository.remove(knowledgeBase);
  }

  async removeForUser(id: number, userId: number): Promise<void> {
    const knowledgeBase = await this.findOneForUser(id, userId);
    await this.knowledgeRepository.remove(knowledgeBase);
  }

  async sync(apiKey: string, kbId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Sync knowledge base: kbId=${kbId}`);
    return {
      success: true,
      message: '知识库同步任务已提交，将在后台执行',
    };
  }
}
