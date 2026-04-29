import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill, SkillReview, SkillUsageStat, User, Organization, JobModel } from '../entities';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    @InjectRepository(SkillReview)
    private reviewRepository: Repository<SkillReview>,
    @InjectRepository(SkillUsageStat)
    private usageStatRepository: Repository<SkillUsageStat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(JobModel)
    private modelRepository: Repository<JobModel>,
  ) {}

  async getStats(tenantId: number = 1) {
    const [
      totalSkills,
      publishedSkills,
      draftSkills,
      archivedSkills,
      pendingReviews,
      totalUsers,
      totalOrgs,
      totalModels,
    ] = await Promise.all([
      this.skillRepository.count({ where: { tenantId } }),
      this.skillRepository.count({ where: { status: 'published', tenantId } }),
      this.skillRepository.count({ where: { status: 'draft', tenantId } }),
      this.skillRepository.count({ where: { status: 'archived', tenantId } }),
      this.reviewRepository.count({ where: { status: 'pending', tenantId } }),
      this.userRepository.count({ where: { tenantId } }),
      this.orgRepository.count({ where: { tenantId } }),
      this.modelRepository.count({ where: { tenantId } }),
    ]);

    // 按领域统计
    const domainStatsRaw = await this.skillRepository
      .createQueryBuilder('skill')
      .select('skill.domain', 'domain')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(CASE WHEN skill.status = \'published\' THEN 1 ELSE 0 END)', 'published')
      .where('skill.tenantId = :tenantId', { tenantId })
      .groupBy('skill.domain')
      .getRawMany();

    const domainStats = domainStatsRaw.map(d => ({
      domain: d.domain,
      count: parseInt(d.count, 10),
      published: parseInt(d.published, 10) || 0,
    }));

    // 最近创建的5个Skill
    const recentSkills = await this.skillRepository.find({
      where: { tenantId },
      relations: ['owner'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    // 计算覆盖率
    const coverageRate = totalSkills > 0 
      ? Math.round((publishedSkills / totalSkills) * 100) / 100 
      : 0;

    return {
      totalSkills,
      publishedSkills,
      draftSkills,
      archivedSkills,
      totalOrgs,
      totalModels,
      totalUsers,
      pendingReviews,
      domainStats,
      recentSkills,
      coverageRate,
    };
  }

  async getOverview(tenantId: number = 1) {
    const [
      totalSkills,
      publishedSkills,
      draftSkills,
      pendingReviews,
      totalUsers,
      totalOrgs,
    ] = await Promise.all([
      this.skillRepository.count({ where: { tenantId } }),
      this.skillRepository.count({ where: { status: 'published', tenantId } }),
      this.skillRepository.count({ where: { status: 'draft', tenantId } }),
      this.reviewRepository.count({ where: { status: 'pending', tenantId } }),
      this.userRepository.count({ where: { tenantId } }),
      this.orgRepository.count({ where: { tenantId } }),
    ]);

    return {
      totalSkills,
      publishedSkills,
      draftSkills,
      pendingReviews,
      totalUsers,
      totalOrgs,
    };
  }

  async getSkillsByDomain(tenantId: number = 1) {
    const skills = await this.skillRepository
      .createQueryBuilder('skill')
      .select('skill.domain', 'domain')
      .addSelect('COUNT(*)', 'count')
      .where('skill.tenantId = :tenantId', { tenantId })
      .groupBy('skill.domain')
      .getRawMany();

    return skills;
  }

  async getRecentActivity(tenantId: number = 1) {
    const recentSkills = await this.skillRepository.find({
      where: { tenantId },
      relations: ['owner'],
      order: { updatedAt: 'DESC' },
      take: 10,
    });

    const recentReviews = await this.reviewRepository.find({
      where: { tenantId },
      relations: ['skill', 'submitter'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { recentSkills, recentReviews };
  }
}
