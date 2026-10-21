
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const UserId = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): number => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.user?.sub;

    if (
      typeof userId !== 'number' ||
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      throw new UnauthorizedException(
        'Authenticated user ID is unavailable',
      );
    }

    return userId;
  },
);
