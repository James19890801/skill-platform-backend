import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JobModel, JobModelSkill, Skill } from '../entities';

@Injectable()
export class ModelsService {
  constructor(
    @InjectRepository(JobModel)
    private modelRepository: Repository<JobModel>,
    @InjectRepository(JobModelSkill)
    private modelSkillRepository: Repository<JobModelSkill>,
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
  ) {}

  async findAll(orgId?: number, tenantId: number = 1) {
    const query: any = { tenantId };
    if (orgId) {
      query.orgId = orgId;
    }
    return this.modelRepository.find({
      where: query,
      relations: ['organization', 'skills', 'skills.skill'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, tenantId: number = 1) {
    const model = await this.modelRepository.findOne({
      where: { id, tenantId },
      relations: ['organization', 'skills', 'skills.skill'],
    });
    if (!model) {
      throw new NotFoundException(`JobModel #${id} not found`);
    }
    return model;
  }

  async create(data: { name: string; description?: string; orgId?: number }, tenantId: number = 1) {
    const model = this.modelRepository.create({
      name: data.name,
      description: data.description || '',
      orgId: data.orgId || undefined,
      tenantId,
    });
    return this.modelRepository.save(model);
  }

  async update(id: number, data: { name?: string; description?: string; orgId?: number }, tenantId: number = 1) {
    const model = await this.findOne(id, tenantId);
    Object.assign(model, data);
    return this.modelRepository.save(model);
  }

  async remove(id: number, tenantId: number = 1) {
    const model = await this.findOne(id, tenantId);
    // 先删除关联的 skills
    await this.modelSkillRepository.delete({ modelId: id });
    await this.modelRepository.remove(model);
    return { success: true, message: `JobModel #${id} deleted` };
  }

  async bindSkills(id: number, skillIds: number[], tenantId: number = 1) {
    const model = await this.findOne(id, tenantId);
    
    // 验证 skills 存在且属于同一租户
    const skills = await this.skillRepository.find({ where: { id: In(skillIds), tenantId } });
    if (skills.length !== skillIds.length) {
      throw new NotFoundException('Some skills not found');
    }

    // 获取已绑定的 skillIds
    const existingBindings = await this.modelSkillRepository.find({ where: { modelId: id } });
    const existingSkillIds = existingBindings.map(b => b.skillId);

    // 只添加新的绑定
    const newSkillIds = skillIds.filter(sid => !existingSkillIds.includes(sid));
    const newBindings = newSkillIds.map(skillId => 
      this.modelSkillRepository.create({ modelId: id, skillId })
    );

    if (newBindings.length > 0) {
      await this.modelSkillRepository.save(newBindings);
    }

    return this.findOne(id, tenantId);
  }

  async unbindSkill(id: number, skillId: number, tenantId: number = 1) {
    await this.findOne(id, tenantId); // 确保 model 存在
    
    const binding = await this.modelSkillRepository.findOne({
      where: { modelId: id, skillId },
    });
    
    if (!binding) {
      throw new NotFoundException(`Skill #${skillId} is not bound to JobModel #${id}`);
    }

    await this.modelSkillRepository.remove(binding);
    return { success: true, message: `Skill #${skillId} unbound from JobModel #${id}` };
  }
}
