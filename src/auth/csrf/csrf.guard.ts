
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

import { CsrfService } from './csrf.service';

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'https://vaf-frontend.vercel.app',
    'https://vinitabhedyafoundation.com',
    'https://www.vinitabhedyafoundation.com',
  ];

  constructor(
    private readonly csrfService: CsrfService,
  ) {}

  private safeCompare(value1: string, value2: string): boolean {
    const buffer1 = Buffer.from(value1);
    const buffer2 = Buffer.from(value2);

    if (buffer1.length !== buffer2.length) {
      return false;
    }

    return timingSafeEqual(buffer1, buffer2);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request>();

    const method = request.method.toUpperCase();

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    const origin = request.headers.origin;

    // Requests without an Origin header are treated as
    // non-browser requests, such as server-to-server calls.
    if (origin && !this.allowedOrigins.includes(origin)) {
  throw new ForbiddenException('Untrusted request origin');
}

    const csrfCookie = request.cookies?.csrf_token;
    const csrfHeader = request.headers['x-csrf-token'];

    if (
      !csrfCookie ||
      typeof csrfHeader !== 'string' ||
      !this.safeCompare(csrfCookie, csrfHeader)
    ) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    const accessToken = request.cookies?.access_token;

    const sessionBinding = accessToken
      ? createHash('sha256').update(accessToken).digest('hex')
      : 'pre-auth';

    if (!this.csrfService.validateToken(csrfCookie, sessionBinding)) {
      throw new ForbiddenException('CSRF token validation failed');
    }

    return true;
  }
}
