import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';

export interface CreateTenantDto {
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  plan?: string;
  // 管理员信息
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private generateApiKey(): string {
    return `sk-${crypto.randomBytes(8).toString('hex')}`;
  }

  async findAll() {
    return this.tenantRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant #${id} not found`);
    }

    return tenant;
  }

  async findByCode(code: string) {
    return this.tenantRepository.findOne({
      where: { code },
    });
  }

  async findByDingtalkCorpId(corpId: string) {
    return this.tenantRepository.findOne({
      where: { dingtalkCorpId: corpId },
    });
  }

  async create(data: CreateTenantDto) {
    // 检查 code 是否已存在
    if (data.code) {
      const existing = await this.findByCode(data.code);
      if (existing) {
        throw new ConflictException(`Tenant code "${data.code}" already exists`);
      }
    }

    // 检查 name 是否已存在
    if (data.name) {
      const existingName = await this.tenantRepository.findOne({
        where: { name: data.name },
      });
      if (existingName) {
        throw new ConflictException(`Tenant name "${data.name}" already exists`);
      }
    }

    // 检查管理员邮箱是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { email: data.adminEmail },
    });
    if (existingUser) {
      throw new ConflictException(`Email "${data.adminEmail}" already exists`);
    }

    // 1. 创建租户
    const tenant = this.tenantRepository.create({
      name: data.name,
      code: data.code,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      plan: data.plan || 'basic',
      status: 'active',
    });
    const savedTenant = await this.tenantRepository.save(tenant);

    // 2. 创建管理员用户
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
    const adminUser = this.userRepository.create({
      name: data.adminName,
      email: data.adminEmail,
      password: hashedPassword,
      role: 'admin',
      tenantId: savedTenant.id,
      apiKey: this.generateApiKey(),
    });
    const savedAdmin = await this.userRepository.save(adminUser);

    return {
      tenant: savedTenant,
      admin: {
        id: savedAdmin.id,
        name: savedAdmin.name,
        email: savedAdmin.email,
        role: savedAdmin.role,
      },
    };
  }

  async update(id: number, data: Partial<Tenant>) {
    const tenant = await this.findOne(id);

    // 如果更新 code，检查是否已存在
    if (data.code && data.code !== tenant.code) {
      const existing = await this.findByCode(data.code);
      if (existing) {
        throw new ConflictException(`Tenant code "${data.code}" already exists`);
      }
    }

    // 如果更新 name，检查是否已存在
    if (data.name && data.name !== tenant.name) {
      const existingName = await this.tenantRepository.findOne({
        where: { name: data.name },
      });
      if (existingName) {
        throw new ConflictException(`Tenant name "${data.name}" already exists`);
      }
    }

    Object.assign(tenant, data);
    return this.tenantRepository.save(tenant);
  }

  async remove(id: number) {
    const tenant = await this.findOne(id);
    
    // 不允许删除 id=1 的默认租户
    if (id === 1) {
      throw new ConflictException('Cannot delete the default tenant');
    }

    await this.tenantRepository.remove(tenant);
    return { success: true, message: `Tenant #${id} deleted` };
  }
}
