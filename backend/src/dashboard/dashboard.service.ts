import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill, SkillReview, User } from '../entities';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    @InjectRepository(SkillReview)
    private reviewRepository: Repository<SkillReview>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getStats() {
    const [
      totalSkills,
      publishedSkills,
      draftSkills,
      archivedSkills,
      pendingReviews,
      totalUsers,
    ] = await Promise.all([
      this.skillRepository.count(),
      this.skillRepository.count({ where: { status: 'published' } }),
      this.skillRepository.count({ where: { status: 'draft' } }),
      this.skillRepository.count({ where: { status: 'archived' } }),
      this.reviewRepository.count({ where: { status: 'pending' } }),
      this.userRepository.count(),
    ]);

    const domainStatsRaw = await this.skillRepository
      .createQueryBuilder('skill')
      .select('skill.domain', 'domain')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(CASE WHEN skill.status = \'published\' THEN 1 ELSE 0 END)', 'published')
      .groupBy('skill.domain')
      .getRawMany();

    const domainStats = domainStatsRaw.map(d => ({
      domain: d.domain,
      count: parseInt(d.count, 10),
      published: parseInt(d.published, 10) || 0,
    }));

    const recentSkills = await this.skillRepository.find({
      relations: ['owner'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const coverageRate = totalSkills > 0 
      ? Math.round((publishedSkills / totalSkills) * 100) / 100 
      : 0;

    return {
      totalSkills,
      publishedSkills,
      draftSkills,
      archivedSkills,
      totalUsers,
      pendingReviews,
      domainStats,
      recentSkills,
      coverageRate,
    };
  }

  async getOverview() {
    const [
      totalSkills,
      publishedSkills,
      draftSkills,
      pendingReviews,
      totalUsers,
    ] = await Promise.all([
      this.skillRepository.count(),
      this.skillRepository.count({ where: { status: 'published' } }),
      this.skillRepository.count({ where: { status: 'draft' } }),
      this.reviewRepository.count({ where: { status: 'pending' } }),
      this.userRepository.count(),
    ]);

    return {
      totalSkills,
      publishedSkills,
      draftSkills,
      pendingReviews,
      totalUsers,
    };
  }

  async getSkillsByDomain() {
    const skills = await this.skillRepository
      .createQueryBuilder('skill')
      .select('skill.domain', 'domain')
      .addSelect('COUNT(*)', 'count')
      .groupBy('skill.domain')
      .getRawMany();

    return skills;
  }

  async getRecentActivity() {
    const recentSkills = await this.skillRepository.find({
      relations: ['owner'],
      order: { updatedAt: 'DESC' },
      take: 10,
    });

    const recentReviews = await this.reviewRepository.find({
      relations: ['skill', 'submitter'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { recentSkills, recentReviews };
  }
}
