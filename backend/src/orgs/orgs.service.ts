import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization, User, Skill } from '../entities';

@Injectable()
export class OrgsService {
  constructor(
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
  ) {}

  async findAll(tenantId: number = 1) {
    return this.orgRepository.find({
      where: { tenantId },
      order: { level: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: number, tenantId: number = 1) {
    const org = await this.orgRepository.findOne({
      where: { id, tenantId },
      relations: ['parent', 'children'],
    });
    if (!org) {
      throw new NotFoundException(`Organization #${id} not found`);
    }
    return org;
  }

  async getTree(tenantId: number = 1) {
    const orgs = await this.orgRepository.find({
      where: { tenantId },
      order: { level: 'ASC', name: 'ASC' },
    });

    // 构建树形结构
    const buildTree = (parentId: number | null): any[] => {
      return orgs
        .filter((org) => (parentId === null ? !org.parentId : org.parentId === parentId))
        .map((org) => ({
          ...org,
          children: buildTree(org.id),
        }));
    };

    return buildTree(null);
  }

  async create(data: { name: string; parentId?: number; description?: string }, tenantId: number = 1) {
    let level = 1;
    let path = '';

    if (data.parentId) {
      const parent = await this.orgRepository.findOne({ where: { id: data.parentId, tenantId } });
      if (!parent) {
        throw new NotFoundException(`Parent organization #${data.parentId} not found`);
      }
      level = parent.level + 1;
      path = parent.path ? `${parent.path}/${data.name}` : `/${data.name}`;
    } else {
      path = `/${data.name}`;
    }

    const org = this.orgRepository.create({
      name: data.name,
      parentId: data.parentId || undefined,
      description: data.description || '',
      level,
      path,
      tenantId,
    });

    return this.orgRepository.save(org);
  }

  async update(id: number, data: { name?: string; description?: string }, tenantId: number = 1) {
    const org = await this.findOne(id, tenantId);
    Object.assign(org, data);
    return this.orgRepository.save(org);
  }

  async remove(id: number, tenantId: number = 1) {
    const org = await this.findOne(id, tenantId);
    
    // 检查是否有子节点
    const children = await this.orgRepository.find({ where: { parentId: id, tenantId } });
    if (children.length > 0) {
      throw new BadRequestException('Cannot delete organization with children. Please delete children first.');
    }

    await this.orgRepository.remove(org);
    return { success: true, message: `Organization #${id} deleted` };
  }

  async getMembers(id: number, tenantId: number = 1) {
    await this.findOne(id, tenantId); // 确保组织存在
    return this.userRepository.find({
      where: { orgId: id, tenantId },
      select: ['id', 'name', 'email', 'role', 'jobTitle', 'createdAt'],
    });
  }

  async getSkills(id: number, tenantId: number = 1) {
    await this.findOne(id, tenantId); // 确保组织存在
    return this.skillRepository.find({
      where: { orgId: id, tenantId },
      relations: ['owner'],
      order: { updatedAt: 'DESC' },
    });
  }
}
