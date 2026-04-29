import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) return true; // 未认证的请求交给 AuthGuard 处理
    
    if (!user.tenantId) {
      throw new ForbiddenException('No tenant context');
    }
    
    // 将 tenantId 挂载到 request 上，方便 Service 层使用
    request.tenantId = user.tenantId;
    return true;
  }
}
