import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * AdminGuard - 检查用户是否为管理员
 * 必须在 AuthGuard 之后使用
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('请先登录');
    }

    if (!user.isAdmin) {
      throw new ForbiddenException('需要管理员权限');
    }

    return true;
  }
}
