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
    const secret =
      configService.get<string>('JWT_SECRET_KEY');

    if (!secret) {
      throw new Error(
        'JWT_SECRET_KEY is missing',
      );
    }

    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: number;
    email: string;
    role: Role;
  }) {
    const user =
await this.databaseService.user.findUnique({
    where:{
        id:payload.sub
    },
    select:{
        id:true,
        email:true,
        role:true,
        status:true,
    }
});

    if (!user) {
      throw new UnauthorizedException(
        'Unauthorized access',
      );
    }

    if (user.status === UserStatus.Pending) {
      throw new UnauthorizedException(
        'Unauthorized access',
      );
    }

    if (user.status === UserStatus.Suspended) {
      throw new UnauthorizedException(
        'Unauthorized access',
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