import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { Role } from '@prisma/client';

import { Request } from 'express';

interface AuthUser {
  sub: number;
  email: string;
  role: Role;
}

@Injectable()
export class RolesGuard
  implements CanActivate
{
  constructor(
    private reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<
        Role[]
      >('roles', [
        context.getHandler(),
        context.getClass(),
      ]);

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

    const roleHierarchy: Record<
      Role,
      number
    > = {
      User: 1,
      Admin: 2,
      SuperAdmin: 3,
    };

    if (
      !user ||
      !user.role ||
      !(user.role in roleHierarchy)
    ) {
      throw new ForbiddenException(
        'Invalid user or role',
      );
    }

    const userLevel =
      roleHierarchy[user.role];

    const requiredLevels =
      requiredRoles.map(
        (role) => roleHierarchy[role],
      );

    const hasAccess =
      requiredLevels.some(
        (level) => userLevel >= level,
      );

    if (!hasAccess) {
      throw new ForbiddenException(
        'Access denied',
      );
    }

    return true;
  }
}