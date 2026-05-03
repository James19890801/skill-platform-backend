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

  async findAll() {
    return this.modelRepository.find({
      relations: ['skills', 'skills.skill'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const model = await this.modelRepository.findOne({
      where: { id },
      relations: ['skills', 'skills.skill'],
    });
    if (!model) {
      throw new NotFoundException(`JobModel #${id} not found`);
    }
    return model;
  }

  async create(data: { name: string; description?: string }) {
    const model = this.modelRepository.create({
      name: data.name,
      description: data.description || '',
    });
    return this.modelRepository.save(model);
  }

  async update(id: number, data: { name?: string; description?: string }) {
    const model = await this.findOne(id);
    Object.assign(model, data);
    return this.modelRepository.save(model);
  }

  async remove(id: number) {
    const model = await this.findOne(id);
    await this.modelSkillRepository.delete({ modelId: id });
    await this.modelRepository.remove(model);
    return { success: true, message: `JobModel #${id} deleted` };
  }

  async bindSkills(id: number, skillIds: number[]) {
    const model = await this.findOne(id);

    const skills = await this.skillRepository.find({ where: { id: In(skillIds) } });
    if (skills.length !== skillIds.length) {
      throw new NotFoundException('Some skills not found');
    }

    const existingBindings = await this.modelSkillRepository.find({ where: { modelId: id } });
    const existingSkillIds = existingBindings.map(b => b.skillId);

    const newSkillIds = skillIds.filter(sid => !existingSkillIds.includes(sid));
    const newBindings = newSkillIds.map(skillId => 
      this.modelSkillRepository.create({ modelId: id, skillId })
    );

    if (newBindings.length > 0) {
      await this.modelSkillRepository.save(newBindings);
    }

    return this.findOne(id);
  }

  async unbindSkill(id: number, skillId: number) {
    await this.findOne(id);

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
