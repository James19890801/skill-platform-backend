import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(email: string, phone: string) {
    // 先按邮箱查找
    let user = await this.userRepository.findOne({
      where: { email },
    });

    // 如果找不到，创建新用户
    if (!user) {
      user = this.userRepository.create({
        email,
        phone,
        firstLoginAt: new Date(),
        lastLoginAt: new Date(),
        loginCount: 1,
      });
      user = await this.userRepository.save(user);
    } else {
      // 已有用户，更新登录信息
      user.lastLoginAt = new Date();
      user.loginCount += 1;
      await this.userRepository.save(user);
    }

    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
    };

    const secret = this.configService.get<string>('JWT_SECRET') || 'skill-platform-secret-key';

    return {
      access_token: this.jwtService.sign(payload, {
        secret,
        expiresIn: '7d',
      }),
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        firstLoginAt: user.firstLoginAt,
        lastLoginAt: user.lastLoginAt,
        loginCount: user.loginCount,
      },
    };
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      firstLoginAt: user.firstLoginAt,
      lastLoginAt: user.lastLoginAt,
      loginCount: user.loginCount,
      createdAt: user.createdAt,
    };
  }
}
