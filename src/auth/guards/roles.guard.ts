import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';

interface AuthenticatedUser {
  sub: number;
  email: string;
  role: Role;
  status: UserStatus;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get roles required from decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      'roles',
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    // No roles specified → allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    // User should already be authenticated by JwtAuthGuard
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // Check whether the user's role is allowed
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Insufficient permissions',
      );
    }

    return true;
  }
}