import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Skill, User, Organization } from '../entities';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
  ) {}

  async search(keyword: string, tenantId: number = 1) {
    if (!keyword || keyword.trim() === '') {
      return { skills: [], users: [], organizations: [] };
    }

    const searchPattern = `%${keyword}%`;

    const [skills, users, organizations] = await Promise.all([
      this.skillRepository.find({
        where: [
          { name: Like(searchPattern), tenantId },
          { namespace: Like(searchPattern), tenantId },
          { description: Like(searchPattern), tenantId },
        ],
        take: 20,
      }),
      this.userRepository.find({
        where: [
          { name: Like(searchPattern), tenantId },
          { email: Like(searchPattern), tenantId },
        ],
        take: 10,
      }),
      this.orgRepository.find({
        where: { name: Like(searchPattern), tenantId },
        take: 10,
      }),
    ]);

    return { skills, users, organizations };
  }

  async searchSkills(keyword: string, filters?: { domain?: string; status?: string }, tenantId: number = 1) {
    const where: any[] = [];

    if (keyword && keyword.trim() !== '') {
      const searchPattern = `%${keyword}%`;
      const baseConditions: any[] = [
        { name: Like(searchPattern), tenantId },
        { namespace: Like(searchPattern), tenantId },
        { description: Like(searchPattern), tenantId },
      ];

      if (filters?.domain || filters?.status) {
        for (const cond of baseConditions) {
          const condition: any = { ...cond };
          if (filters.domain) condition.domain = filters.domain;
          if (filters.status) condition.status = filters.status;
          where.push(condition);
        }
      } else {
        where.push(...baseConditions);
      }
    } else if (filters?.domain || filters?.status) {
      const condition: any = { tenantId };
      if (filters.domain) condition.domain = filters.domain;
      if (filters.status) condition.status = filters.status;
      where.push(condition);
    } else {
      where.push({ tenantId });
    }

    return this.skillRepository.find({
      where: where.length > 0 ? where : undefined,
      relations: ['owner', 'organization'],
      take: 50,
    });
  }
}
