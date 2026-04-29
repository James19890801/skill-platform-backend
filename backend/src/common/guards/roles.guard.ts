import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    
    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    
    // admin 拥有所有权限
    if (user.role === 'admin') return true;
    // manager 拥有 manager 和 member 权限
    if (user.role === 'manager' && requiredRoles.some(r => ['manager', 'member'].includes(r))) return true;
    // member 只有 member 权限
    return requiredRoles.includes(user.role);
  }
}
