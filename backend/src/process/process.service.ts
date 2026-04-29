import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProcess, ProcessDocument } from '../entities';

@Injectable()
export class ProcessService {
  constructor(
    @InjectRepository(BusinessProcess)
    private processRepository: Repository<BusinessProcess>,
    @InjectRepository(ProcessDocument)
    private documentRepository: Repository<ProcessDocument>,
  ) {}

  async findAll(filters?: { domain?: string; archNodeId?: number; status?: string }, tenantId: number = 1) {
    const query = this.processRepository.createQueryBuilder('process');
    
    query.where('process.tenantId = :tenantId', { tenantId });

    if (filters?.domain) {
      query.andWhere('process.domain = :domain', { domain: filters.domain });
    }

    if (filters?.archNodeId) {
      query.andWhere('process.archNodeId = :archNodeId', { archNodeId: filters.archNodeId });
    }

    if (filters?.status) {
      query.andWhere('process.status = :status', { status: filters.status });
    }

    query.orderBy('process.createdAt', 'DESC');

    return query.getMany();
  }

  async findOne(id: number, tenantId: number = 1) {
    const process = await this.processRepository.findOne({
      where: { id, tenantId },
      relations: ['documents'],
    });

    if (!process) {
      throw new NotFoundException(`流程 #${id} 不存在`);
    }

    return process;
  }

  async create(data: Partial<BusinessProcess>, tenantId: number = 1) {
    const process = this.processRepository.create({ ...data, tenantId });
    return this.processRepository.save(process);
  }

  async update(id: number, data: Partial<BusinessProcess>, tenantId: number = 1) {
    const process = await this.processRepository.findOne({ where: { id, tenantId } });
    if (!process) {
      throw new NotFoundException(`流程 #${id} 不存在`);
    }
    Object.assign(process, data);
    return this.processRepository.save(process);
  }

  async remove(id: number, tenantId: number = 1) {
    const process = await this.processRepository.findOne({ where: { id, tenantId } });
    if (!process) {
      throw new NotFoundException(`流程 #${id} 不存在`);
    }

    // 删除关联的文档
    await this.documentRepository.delete({ processId: id });

    // 删除流程
    await this.processRepository.delete(id);

    return { success: true };
  }

  async addDocument(processId: number, data: Partial<ProcessDocument>, tenantId: number = 1) {
    const process = await this.processRepository.findOne({ where: { id: processId, tenantId } });
    if (!process) {
      throw new NotFoundException(`流程 #${processId} 不存在`);
    }

    const document = this.documentRepository.create({
      ...data,
      processId,
    });

    const savedDoc = await this.documentRepository.save(document);

    // 更新流程的 sopCount
    if (data.type === 'sop') {
      process.sopCount += 1;
      await this.processRepository.save(process);
    }

    return savedDoc;
  }

  async removeDocument(processId: number, docId: number, tenantId: number = 1) {
    const process = await this.processRepository.findOne({ where: { id: processId, tenantId } });
    if (!process) {
      throw new NotFoundException(`流程 #${processId} 不存在`);
    }

    const document = await this.documentRepository.findOne({
      where: { id: docId, processId },
    });

    if (!document) {
      throw new NotFoundException(`文档 #${docId} 不存在`);
    }

    // 更新流程的 sopCount
    if (document.type === 'sop') {
      if (process.sopCount > 0) {
        process.sopCount -= 1;
        await this.processRepository.save(process);
      }
    }

    await this.documentRepository.delete(docId);

    return { success: true };
  }
}
