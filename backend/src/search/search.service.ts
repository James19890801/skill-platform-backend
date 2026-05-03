import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Skill, User } from '../entities';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async search(keyword: string) {
    if (!keyword || keyword.trim() === '') {
      return { skills: [], users: [] };
    }

    const searchPattern = `%${keyword}%`;

    const [skills, users] = await Promise.all([
      this.skillRepository.find({
        where: [
          { name: Like(searchPattern) },
          { namespace: Like(searchPattern) },
          { description: Like(searchPattern) },
        ],
        take: 20,
      }),
      this.userRepository.find({
        where: [
          { email: Like(searchPattern) },
          { phone: Like(searchPattern) },
        ],
        take: 10,
      }),
    ]);

    return { skills, users };
  }

  async searchSkills(keyword: string, filters?: { domain?: string; status?: string }) {
    const where: any[] = [];

    if (keyword && keyword.trim() !== '') {
      const searchPattern = `%${keyword}%`;
      const baseConditions: any[] = [
        { name: Like(searchPattern) },
        { namespace: Like(searchPattern) },
        { description: Like(searchPattern) },
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
      const condition: any = {};
      if (filters.domain) condition.domain = filters.domain;
      if (filters.status) condition.status = filters.status;
      where.push(condition);
    }

    return this.skillRepository.find({
      where: where.length > 0 ? where : undefined,
      relations: ['owner'],
      take: 50,
    });
  }
}
