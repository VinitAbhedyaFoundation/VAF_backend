import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const UserEmail = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): string => {
    const request = ctx.switchToHttp().getRequest();
    const email = request.user?.email;

    if (typeof email !== 'string' || !email) {
      throw new UnauthorizedException(
        'Authenticated user email is unavailable',
      );
    }

    return email;
  },
);