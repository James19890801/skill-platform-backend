import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

/**
 * AuthGuard - 要求用户必须登录
 * 配合 JwtStrategy 使用，验证 JWT token
 */
@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {}
