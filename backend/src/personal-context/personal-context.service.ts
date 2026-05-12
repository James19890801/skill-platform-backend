import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserContext } from '../entities/user-context.entity';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { MemoryService } from '../memory/memory.service';
import { McpService } from '../mcp/mcp.service';
import { UpdatePersonalContextDto } from './dto/update-personal-context.dto';
import { CreateMemoryDto } from '../memory/dto/create-memory.dto';

@Injectable()
export class PersonalContextService {
  constructor(
    @InjectRepository(UserContext)
    private readonly contextRepository: Repository<UserContext>,
    @InjectRepository(KnowledgeBase)
    private readonly knowledgeRepository: Repository<KnowledgeBase>,
    private readonly knowledgeService: KnowledgeService,
    private readonly memoryService: MemoryService,
    private readonly mcpService: McpService,
  ) {}

  async getOrCreate(userId: number): Promise<UserContext> {
    let context = await this.contextRepository.findOne({ where: { userId } });
    if (!context) {
      context = await this.contextRepository.save(this.contextRepository.create({
        userId,
        knowledgeBaseIds: [],
        mcpServers: [],
        memoryEnabled: true,
      }));
    }
    return this.normalizeContext(context);
  }

  async getDashboard(userId: number) {
    const [context, knowledgeBases, memories] = await Promise.all([
      this.getOrCreate(userId),
      this.knowledgeService.findAllByUserId(userId),
      this.memoryService.findPersonal(userId),
    ]);

    return {
      ...context,
      knowledgeBases,
      memories,
      mcpMarketplace: this.mcpService.getMarketplace(),
    };
  }

  async update(userId: number, dto: UpdatePersonalContextDto): Promise<UserContext> {
    const context = await this.getOrCreate(userId);

    if (dto.knowledgeBaseIds !== undefined) {
      context.knowledgeBaseIds = await this.validateKnowledgeBaseIds(userId, dto.knowledgeBaseIds);
    }
    if (dto.mcpServers !== undefined) {
      context.mcpServers = this.mcpService.normalize(dto.mcpServers);
    }
    if (dto.memoryEnabled !== undefined) {
      context.memoryEnabled = dto.memoryEnabled;
    }

    return this.normalizeContext(await this.contextRepository.save(context));
  }

  async createMemory(userId: number, dto: Pick<CreateMemoryDto, 'key' | 'value' | 'category'>) {
    if (!dto.value?.trim()) {
      throw new BadRequestException('记忆内容不能为空');
    }
    const key = dto.key?.trim() || dto.value.trim().slice(0, 24);
    return this.memoryService.createPersonal(userId, {
      key,
      value: dto.value.trim(),
      category: dto.category,
    });
  }

  async deleteMemory(userId: number, memoryId: number) {
    return this.memoryService.removePersonal(memoryId, userId);
  }

  async getRuntimeContext(userId?: number): Promise<{
    knowledgeBaseIds: number[];
    mcpServers: unknown[];
    memoryContext: string;
  }> {
    if (!userId) {
      return { knowledgeBaseIds: [], mcpServers: [], memoryContext: '' };
    }

    const context = await this.getOrCreate(userId);
    const memoryContext = context.memoryEnabled
      ? await this.memoryService.buildPersonalMemoryContext(userId)
      : '';

    return {
      knowledgeBaseIds: context.knowledgeBaseIds,
      mcpServers: context.mcpServers || [],
      memoryContext,
    };
  }

  private async validateKnowledgeBaseIds(userId: number, ids: number[]): Promise<number[]> {
    const uniqueIds = Array.from(new Set(
      ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ));
    if (uniqueIds.length === 0) return [];

    const owned = await this.knowledgeRepository.find({
      where: { id: In(uniqueIds), userId },
      select: ['id'],
    });
    const ownedIds = new Set(owned.map((item) => item.id));
    const invalidIds = uniqueIds.filter((id) => !ownedIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`这些知识库不属于当前用户: ${invalidIds.join(', ')}`);
    }

    return uniqueIds;
  }

  private normalizeContext(context: UserContext): UserContext {
    context.knowledgeBaseIds = Array.isArray(context.knowledgeBaseIds) ? context.knowledgeBaseIds : [];
    context.mcpServers = Array.isArray(context.mcpServers) ? context.mcpServers : [];
    context.memoryEnabled = context.memoryEnabled !== false;
    return context;
  }
}
