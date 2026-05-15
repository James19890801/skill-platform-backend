import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  private readonly loginAuditDelayMs = Math.max(Number(process.env.AUTH_LOGIN_AUDIT_DELAY_MS || 10000), 0);
  private readonly pendingLoginAudits = new Map<number, { count: number; lastLoginAt: Date }>();
  private loginAuditTimer: NodeJS.Timeout | null = null;
  private flushingLoginAudits = false;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private getAdminEmail() {
    return (process.env.ADMIN_EMAIL || '494161546@qq.com').trim().toLowerCase();
  }

  private getAdminPhone() {
    return (process.env.ADMIN_PHONE || '13136092523').trim();
  }

  private async releaseAdminPhoneIfNeeded(currentUserId?: number) {
    const adminPhone = this.getAdminPhone();
    const phoneOwner = await this.userRepository.findOne({ where: { phone: adminPhone } });
    if (phoneOwner && phoneOwner.id !== currentUserId) {
      phoneOwner.phone = null;
      await this.userRepository.save(phoneOwner);
    }
  }

  private async applyAdminPolicy(user: User) {
    const isConfiguredAdmin = user.email.trim().toLowerCase() === this.getAdminEmail();
    if (!isConfiguredAdmin) return user;

    await this.releaseAdminPhoneIfNeeded(user.id);

    let changed = false;
    if (!user.isAdmin) {
      user.isAdmin = true;
      changed = true;
    }
    if (user.phone !== this.getAdminPhone()) {
      user.phone = this.getAdminPhone();
      changed = true;
    }

    return changed ? this.userRepository.save(user) : user;
  }

  async login(email: string, phone: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const isConfiguredAdmin = normalizedEmail === this.getAdminEmail();

    if (isConfiguredAdmin) {
      await this.releaseAdminPhoneIfNeeded();
    }

    // 先按邮箱查找
    let user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    // 如果找不到，创建新用户
    if (!user) {
      user = this.userRepository.create({
        email: normalizedEmail,
        phone: isConfiguredAdmin ? this.getAdminPhone() : phone,
        isAdmin: isConfiguredAdmin,
        firstLoginAt: new Date(),
        lastLoginAt: new Date(),
        loginCount: 1,
      });
      user = await this.userRepository.save(user);
    } else {
      // 已有用户的登录审计不阻塞登录主路径，避免培训入场时形成数据库写尖峰。
      const loggedInAt = new Date();
      this.scheduleLoginAudit(user.id, loggedInAt);
      user.lastLoginAt = loggedInAt;
      user.loginCount += 1;
    }

    user = await this.applyAdminPolicy(user);

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

  private scheduleLoginAudit(userId: number, lastLoginAt: Date) {
    const existing = this.pendingLoginAudits.get(userId);
    this.pendingLoginAudits.set(userId, {
      count: (existing?.count || 0) + 1,
      lastLoginAt,
    });

    this.scheduleLoginAuditFlush();
  }

  private scheduleLoginAuditFlush() {
    if (this.loginAuditTimer) return;

    this.loginAuditTimer = setTimeout(() => {
      this.loginAuditTimer = null;
      void this.flushPendingLoginAudits();
    }, this.loginAuditDelayMs);
    if (typeof this.loginAuditTimer.unref === 'function') {
      this.loginAuditTimer.unref();
    }
  }

  async flushPendingLoginAudits() {
    if (this.flushingLoginAudits || this.pendingLoginAudits.size === 0) return;
    this.flushingLoginAudits = true;
    const entries = [...this.pendingLoginAudits.entries()];
    this.pendingLoginAudits.clear();

    try {
      for (const [id, audit] of entries) {
        try {
          await this.userRepository.update({ id }, { lastLoginAt: audit.lastLoginAt });
          await this.userRepository.increment({ id }, 'loginCount', audit.count);
        } catch (err) {
          console.warn('登录审计异步写入失败（非致命）:', err instanceof Error ? err.message : err);
        }
      }
    } finally {
      this.flushingLoginAudits = false;
      if (this.pendingLoginAudits.size > 0 && !this.loginAuditTimer) {
        this.scheduleLoginAuditFlush();
      }
    }
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
