import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Get roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. If no roles → allow (important)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 3. Get user from request (added by JWT strategy)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 4. Role hierarchy (important concept)
    const roleHierarchy: Record<Role, number> = {
      User: 1,
      Admin: 2,
      SuperAdmin: 3,
    };

    // 5. Validate user + role
    if (!user || !user.role || !(user.role in roleHierarchy)) {
      throw new ForbiddenException('Invalid user or role');
    }

    // 6. Compare role levels
    const userLevel = roleHierarchy[user.role];
    const requiredLevels = requiredRoles.map(role => roleHierarchy[role]);

    const hasAccess = requiredLevels.some(level => userLevel >= level);

    // 7. Deny if not allowed
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}