import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';

interface AuthUser {
  sub: number;
  email: string;
  role: Role;
}

const ROLE_HIERARCHY: Record<Role, number> = {
  User: 1,
  Admin: 2,
  SuperAdmin: 3,
};

@Injectable()
export class RolesGuard
  implements CanActivate
{
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(
        'roles',
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (
      !requiredRoles ||
      requiredRoles.length === 0
    ) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<Request>();

    const user =
      request.user as AuthUser;

    if (
      !user ||
      !user.role ||
      !(user.role in ROLE_HIERARCHY)
    ) {
      throw new ForbiddenException(
        'Invalid user or role',
      );
    }

    const userLevel =
      ROLE_HIERARCHY[user.role];

    const hasAccess =
      requiredRoles.some(
        (role) =>
          userLevel >= ROLE_HIERARCHY[role],
      );

    if (!hasAccess) {
      throw new ForbiddenException(
        'Access denied',
      );
    }

    return true;
  }
}