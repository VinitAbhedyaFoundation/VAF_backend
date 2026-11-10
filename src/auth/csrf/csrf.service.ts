import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  generateCsrfToken,
  verifyCsrfToken,
} from './csrf.util';

@Injectable()
export class CsrfService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  private getCsrfSecret(): string {
    const secret =
      this.configService.get<string>('CSRF_SECRET_KEY');

    if (!secret || secret.trim().length < 32) {
      throw new InternalServerErrorException(
        'CSRF configuration error',
      );
    }

    return secret;
  }

  generateToken(sessionBinding: string): string {
    return generateCsrfToken(
      this.getCsrfSecret(),
      sessionBinding,
    );
  }

  validateToken(
    token: string,
    sessionBinding: string,
  ): boolean {
    if (!token || !sessionBinding) {
      return false;
    }

    return verifyCsrfToken(
      token,
      this.getCsrfSecret(),
      sessionBinding,
    );
  }
}