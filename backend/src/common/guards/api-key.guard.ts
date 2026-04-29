import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    const user = await this.userRepository.findOne({
      where: { apiKey },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid API Key');
    }

    // 将用户信息挂载到 request 上
    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      tenantId: user.tenantId,
    };
    request.tenantId = user.tenantId;

    return true;
  }
}
