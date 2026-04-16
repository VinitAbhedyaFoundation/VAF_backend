import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { DatabaseService } from "src/database/database.service";
import { Role } from "@prisma/client";

@Injectable()
export class SuperAdminJwtStrategy extends PassportStrategy(Strategy, 'jwt-superadmin') {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
secretOrKey: configService.get<string>('JWT_SECRET_KEY'),    });
  }

  async validate(payload: any) {
    const user = await this.databaseService.user.findUnique({
      where: { id: payload.sub },
    });

    // ❌ user not found
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // ❌ not superadmin
    if (user.role !== Role.SuperAdmin) {
      throw new UnauthorizedException('Access denied');
    }

    // ✅ remove password safely
    const { password, ...result } = user;

    return result;
  }
}