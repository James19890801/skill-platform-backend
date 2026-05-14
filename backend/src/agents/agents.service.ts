import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../entities';
import { CreateAgentDto, UpdateAgentDto } from './dto';
import { McpService } from '../mcp/mcp.service';

@Injectable()
export class AgentsService {
  private readonly listCacheTtlMs = Math.max(Number(process.env.AGENTS_LIST_CACHE_TTL_MS || 15000), 0);
  private listCache: { expiresAt: number; payload: { items: ReturnType<AgentsService['parseAgent']>[]; total: number } } | null = null;

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    private mcpService: McpService,
  ) {}

  async findAll() {
    const now = Date.now();
    if (this.listCache && this.listCache.expiresAt > now) {
      return this.cloneAgentListPayload(this.listCache.payload);
    }

    const [items, total] = await this.agentRepository.findAndCount({
      select: [
        'id',
        'name',
        'description',
        'avatar',
        'model',
        'skills',
        'knowledgeBases',
        'memoryEnabled',
        'temperature',
        'maxTokens',
        'status',
        'ownerId',
        'capabilityTreeId',
        'createdAt',
        'updatedAt',
      ],
      order: { updatedAt: 'DESC' },
    });
    const payload = {
      items: items.map((agent) => this.parseAgent(agent)),
      total,
    };
    this.listCache = {
      expiresAt: now + this.listCacheTtlMs,
      payload,
    };
    return this.cloneAgentListPayload(payload);
  }

  async findOne(id: number) {
    const agent = await this.agentRepository.findOne({
      where: { id },
    });
    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }
    return this.parseAgent(agent);
  }

  async create(dto: CreateAgentDto, ownerId: number) {
    const agent = this.agentRepository.create({
      ...dto,
      skills: dto.skills ? JSON.stringify(dto.skills) : '[]',
      capabilityTreeId: dto.capabilityTreeId ?? null,
      capabilityTreeSnapshot: dto.capabilityTreeSnapshot ? JSON.stringify(dto.capabilityTreeSnapshot) : '[]',
      knowledgeBases: dto.knowledgeBases ? JSON.stringify(dto.knowledgeBases) : '[]',
      mcpServers: dto.mcpServers ? JSON.stringify(this.mcpService.normalize(dto.mcpServers)) : '[]',
      ownerId,
    });
    const saved = await this.agentRepository.save(agent);
    this.invalidateListCache();
    return this.parseAgent(saved);
  }

  async update(id: number, dto: UpdateAgentDto, userId: number, isAdmin: boolean) {
    const agent = await this.findOne(id);

    // 非管理员只能编辑自己的 Agent
    if (!isAdmin && agent.ownerId !== userId) {
      throw new ForbiddenException('只能编辑自己的 Agent');
    }

    const updateData: any = { ...dto };
    if (dto.skills !== undefined) {
      updateData.skills = JSON.stringify(dto.skills);
    }
    if (dto.capabilityTreeId !== undefined) {
      updateData.capabilityTreeId = dto.capabilityTreeId;
    }
    if (dto.capabilityTreeSnapshot !== undefined) {
      updateData.capabilityTreeSnapshot = JSON.stringify(dto.capabilityTreeSnapshot);
    }
    if (dto.knowledgeBases !== undefined) {
      updateData.knowledgeBases = JSON.stringify(dto.knowledgeBases);
    }
    if (dto.mcpServers !== undefined) {
      updateData.mcpServers = JSON.stringify(this.mcpService.normalize(dto.mcpServers));
    }
    await this.agentRepository.update(id, updateData);
    this.invalidateListCache();
    return this.findOne(id);
  }

  async remove(id: number, userId: number, isAdmin: boolean) {
    const agent = await this.findOne(id);

    // 非管理员只能删除自己的 Agent
    if (!isAdmin && agent.ownerId !== userId) {
      throw new ForbiddenException('只能删除自己的 Agent');
    }

    await this.agentRepository.delete(id);
    this.invalidateListCache();
    return agent;
  }

  private invalidateListCache() {
    this.listCache = null;
  }

  private cloneAgentListPayload(payload: { items: ReturnType<AgentsService['parseAgent']>[]; total: number }) {
    return {
      total: payload.total,
      items: payload.items.map((agent) => ({
        ...agent,
        skills: [...agent.skills],
        capabilityTreeSnapshot: [...agent.capabilityTreeSnapshot],
        knowledgeBases: [...agent.knowledgeBases],
        mcpServers: [...agent.mcpServers],
      })),
    };
  }

  private parseAgent(agent: Agent) {
    return {
      ...agent,
      skills: this.parseJsonArray(agent.skills),
      capabilityTreeSnapshot: this.parseJsonArray(agent.capabilityTreeSnapshot),
      knowledgeBases: this.parseJsonArray(agent.knowledgeBases),
      mcpServers: this.parseJsonArray(agent.mcpServers),
    };
  }

  private parseJsonArray(value?: string | null) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
