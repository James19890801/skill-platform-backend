import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../entities';
import { CreateAgentDto, UpdateAgentDto } from './dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
  ) {}

  async findAll() {
    const [items, total] = await this.agentRepository.findAndCount({
      order: { updatedAt: 'DESC' },
    });
    return {
      items: items.map(this.parseAgent),
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
      knowledgeBases: dto.knowledgeBases ? JSON.stringify(dto.knowledgeBases) : '[]',
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
    if (dto.knowledgeBases !== undefined) {
      updateData.knowledgeBases = JSON.stringify(dto.knowledgeBases);
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
      skills: agent.skills ? JSON.parse(agent.skills) : [],
      knowledgeBases: agent.knowledgeBases ? JSON.parse(agent.knowledgeBases) : [],
    };
  }
}
