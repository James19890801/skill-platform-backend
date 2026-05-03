import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Memory } from '../entities/memory.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

@Injectable()
export class MemoryService {
  constructor(
    @InjectRepository(Memory)
    private memoryRepository: Repository<Memory>,
  ) {}

  async create(dto: CreateMemoryDto): Promise<Memory> {
    const memory = new Memory();
    memory.agentId = dto.agentId;
    memory.key = dto.key;
    memory.value = dto.value;
    memory.category = dto.category || 'fact';
    return await this.memoryRepository.save(memory);
  }

  async findAll(agentId?: number): Promise<Memory[]> {
    const where: any = {};
    if (agentId) where.agentId = agentId;
    return await this.memoryRepository.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Memory> {
    const memory = await this.memoryRepository.findOne({
      where: { id },
    });
    if (!memory) throw new NotFoundException(`Memory with ID ${id} not found`);
    return memory;
  }

  async update(id: number, dto: UpdateMemoryDto): Promise<Memory> {
    const memory = await this.findOne(id);
    Object.assign(memory, dto);
    return await this.memoryRepository.save(memory);
  }

  async remove(id: number): Promise<void> {
    const memory = await this.findOne(id);
    await this.memoryRepository.remove(memory);
  }
}
