import {
  Injectable,
  NotFoundException,
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

  async findAll(tenantId: number = 1) {
    const [items, total] = await this.agentRepository.findAndCount({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
    });
    return {
      items: items.map(this.parseAgent),
      total,
    };
  }

  async findAllByUserId(userId?: number, tenantId: number = 1) {
    const whereCondition: any = { tenantId };
    if (userId) {
      whereCondition.ownerId = userId;
    }
    
    const [items, total] = await this.agentRepository.findAndCount({
      where: whereCondition,
      order: { updatedAt: 'DESC' },
    });
    return {
      items: items.map(this.parseAgent),
      total,
    };
  }

  async findOneForUser(id: number, userId: number, tenantId: number = 1) {
    const agent = await this.agentRepository.findOne({
      where: { id, tenantId, ownerId: userId },
    });
    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found or not owned by user`);
    }
    return this.parseAgent(agent);
  }

  async findOne(id: number, tenantId: number = 1) {
    const agent = await this.agentRepository.findOne({
      where: { id, tenantId },
    });
    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }
    return this.parseAgent(agent);
  }

  async create(dto: CreateAgentDto, ownerId: number, tenantId: number = 1) {
    const agent = this.agentRepository.create({
      ...dto,
      skills: dto.skills ? JSON.stringify(dto.skills) : '[]',
      knowledgeBases: dto.knowledgeBases ? JSON.stringify(dto.knowledgeBases) : '[]',
      ownerId,
      tenantId,
    });
    const saved = await this.agentRepository.save(agent);
    return this.parseAgent(saved);
  }

  async update(id: number, dto: UpdateAgentDto, tenantId: number = 1) {
    const agent = await this.findOne(id, tenantId);
    const updateData: any = { ...dto };
    if (dto.skills !== undefined) {
      updateData.skills = JSON.stringify(dto.skills);
    }
    if (dto.knowledgeBases !== undefined) {
      updateData.knowledgeBases = JSON.stringify(dto.knowledgeBases);
    }
    await this.agentRepository.update(id, updateData);
    return this.findOne(id, tenantId);
  }

  async remove(id: number, tenantId: number = 1) {
    const agent = await this.findOne(id, tenantId);
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
