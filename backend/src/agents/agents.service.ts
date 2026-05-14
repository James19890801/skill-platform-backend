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
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    private mcpService: McpService,
  ) {}

  async findAll() {
    const [items, total] = await this.agentRepository.findAndCount({
      order: { updatedAt: 'DESC' },
    });
    return {
      items: items.map((agent) => this.parseAgent(agent)),
      total,
    };
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
    return this.findOne(id);
  }

  async remove(id: number, userId: number, isAdmin: boolean) {
    const agent = await this.findOne(id);

    // 非管理员只能删除自己的 Agent
    if (!isAdmin && agent.ownerId !== userId) {
      throw new ForbiddenException('只能删除自己的 Agent');
    }

    await this.agentRepository.delete(id);
    return agent;
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
