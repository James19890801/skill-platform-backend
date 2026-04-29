import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<User | null> {
    // 首先尝试按邮箱查找用户
    let user = await this.userRepository.findOne({
      where: { email: identifier },
      relations: ['organization'],
    });

    // 如果没找到邮箱，尝试按手机号查找
    if (!user) {
      user = await this.userRepository.findOne({
        where: { phone: identifier },
        relations: ['organization'],
      });
    }

    if (!user) {
      return null;
    }

    // 使用 bcrypt 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      return user;
    }

    return null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,  // 新增租户ID
    };

    const secret = this.configService.get<string>('JWT_SECRET') || 'skill-platform-secret-key';

    return {
      access_token: this.jwtService.sign(payload, {
        secret,
        expiresIn: '7d',
      }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        tenantId: user.tenantId,  // 新增租户ID
        organization: user.organization
          ? {
              id: user.organization.id,
              name: user.organization.name,
              path: user.organization.path,
            }
          : null,
      },
    };
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jobTitle: user.jobTitle,
      orgId: user.orgId,
      tenantId: user.tenantId,  // 新增租户ID
      apiKey: user.apiKey,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            path: user.organization.path,
          }
        : null,
      createdAt: user.createdAt,
    };
  }

  async logout() {
    return { success: true };
  }
}
