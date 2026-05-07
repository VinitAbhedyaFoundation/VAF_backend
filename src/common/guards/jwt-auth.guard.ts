import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard(
  'jwt',
) {
  handleRequest(
    err: unknown,
    user: any,
    info: unknown,
    context: ExecutionContext,
  ) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException()
      );
    }

    return user;
  }
}