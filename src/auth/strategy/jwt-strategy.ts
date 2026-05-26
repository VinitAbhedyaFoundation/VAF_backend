import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PassportStrategy } from '@nestjs/passport';

import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';

import { DatabaseService } from '../../database/database.service';
import { UserStatus, Role } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  'jwt',
) {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey:
        configService.get<string>(
          'JWT_SECRET_KEY',
        ) || 'supersecret',
    });
  }

  async validate(payload: {
    sub: number;
    email: string;
    role: Role;
  }) {
    const user =
      await this.databaseService.user.findUnique({
        where: {
          id: payload.sub,
        },
      });

    if (!user) {
      throw new UnauthorizedException(
        'User not found',
      );
    }

    if (user.status === UserStatus.Pending) {
      throw new UnauthorizedException(
        'Account not approved yet',
      );
    }

    if (user.status === UserStatus.Suspended) {
      throw new UnauthorizedException(
        'Account suspended',
      );
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}