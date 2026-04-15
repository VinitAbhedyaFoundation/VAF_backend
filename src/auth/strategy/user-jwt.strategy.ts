import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { DatabaseService } from "src/database/database.service";
import { Role } from "@prisma/client";

@Injectable()
export class UserJwtStrategy extends PassportStrategy(Strategy, 'jwt-user') {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
secretOrKey: configService.get<string>('JWT_SECRET_KEY'),    });
  }

  async validate(payload: { sub: number; email: string }) {
    const user = await this.databaseService.user.findUnique({
      where: { id: payload.sub },
    });

    // ❌ user not found
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // ❌ not a normal user
    if (user.role !== Role.User) {
      throw new UnauthorizedException('Access denied');
    }

    // ✅ safe return (no password)
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}