import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from '../entities/skill.entity';
import { SkillPackage, buildSkillPackage } from './skill-package';

@Injectable()
export class SkillLoaderService {
  constructor(
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
  ) {}

  async loadPublishedPackage(skillId: number): Promise<{ skill: Skill; pkg: SkillPackage }> {
    const skill = await this.skillRepository.findOne({ where: { id: skillId } });
    if (!skill) {
      throw new NotFoundException(`Skill #${skillId} 不存在`);
    }
    if (skill.status !== 'published') {
      throw new NotFoundException(`Skill #${skillId} 未发布，无法执行`);
    }

    const pkg = buildSkillPackage(skill as any);
    if (skill.packageHash !== pkg.packageHash) {
      skill.packageHash = pkg.packageHash;
      await this.skillRepository.save(skill);
    }

    return { skill, pkg };
  }

  async listPublishedPackages(limit = 100): Promise<Array<{ skill: Skill; pkg: SkillPackage }>> {
    const skills = await this.skillRepository.find({
      where: { status: 'published' },
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    return skills.flatMap((skill) => {
      try {
        return [{ skill, pkg: buildSkillPackage(skill as any) }];
      } catch {
        return [];
      }
    });
  }
}
