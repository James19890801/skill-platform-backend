import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillReview, Skill } from '../entities';
import { ReviewQueryDto, ApproveReviewDto, RejectReviewDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(SkillReview)
    private reviewRepository: Repository<SkillReview>,
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
  ) {}

  async findAll(query: ReviewQueryDto, tenantId: number = 1) {
    const { status, page = 1, limit = 10 } = query;

    const where: any = { tenantId };
    if (status) where.status = status;

    const [items, total] = await this.reviewRepository.findAndCount({
      where,
      relations: ['skill', 'submitter', 'reviewer'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number, tenantId: number = 1) {
    const review = await this.reviewRepository.findOne({
      where: { id, tenantId },
      relations: ['skill', 'skill.owner', 'skill.versions', 'submitter', 'reviewer'],
    });

    if (!review) {
      throw new NotFoundException(`Review #${id} not found`);
    }

    return review;
  }

  async approve(id: number, dto: ApproveReviewDto, reviewerId: number, tenantId: number = 1) {
    const review = await this.findOne(id, tenantId);

    if (review.status !== 'pending') {
      throw new BadRequestException('Only pending reviews can be approved');
    }

    // 更新审核记录
    review.status = 'approved';
    review.reviewerId = reviewerId;
    if (dto.comment) {
      review.comment = dto.comment;
    }
    await this.reviewRepository.save(review);

    // 更新 Skill 状态为 published，并更新 scope
    const skill = await this.skillRepository.findOne({
      where: { id: review.skillId },
    });
    if (skill) {
      skill.status = 'published';
      skill.scope = review.targetScope;
      await this.skillRepository.save(skill);
    }

    return this.findOne(id, tenantId);
  }

  async reject(id: number, dto: RejectReviewDto, reviewerId: number, tenantId: number = 1) {
    const review = await this.findOne(id, tenantId);

    if (review.status !== 'pending') {
      throw new BadRequestException('Only pending reviews can be rejected');
    }

    // 更新审核记录
    review.status = 'rejected';
    review.reviewerId = reviewerId;
    review.comment = dto.reason;
    await this.reviewRepository.save(review);

    // 更新 Skill 状态为 draft（允许重新修改）
    const skill = await this.skillRepository.findOne({
      where: { id: review.skillId },
    });
    if (skill) {
      skill.status = 'draft';
      await this.skillRepository.save(skill);
    }

    return this.findOne(id, tenantId);
  }
}
