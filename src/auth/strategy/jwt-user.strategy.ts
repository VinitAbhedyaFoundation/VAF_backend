import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { DatabaseService } from "src/database/database.service";
import { Role } from "@prisma/client";

@Injectable()
export class UserJwtStrategy extends PassportStrategy(Strategy, 'jwt') { // ✅ FIXED
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET_KEY') || 'supersecret',
    });
  }

  async validate(payload: { sub: number; email: string }) {
    const user = await this.databaseService.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role !== Role.User) {
      throw new UnauthorizedException('Access denied');
    }

    return {
      sub: user.id, // ✅ important for controller
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}