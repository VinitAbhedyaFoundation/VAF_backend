import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminJwtStrategy } from './strategy/admin-jwt.strategy';
import { UserJwtStrategy } from './strategy/user-jwt.strategy';
import { SuperAdminJwtStrategy } from './strategy/superadmin-jwt.strategy';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'supersecret',
        signOptions: {
          expiresIn: '7d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminJwtStrategy,
    UserJwtStrategy,
    SuperAdminJwtStrategy,
  ],

  // ✅ ADDED (IMPORTANT)
  exports: [AuthService],
})
export class AuthModule {}