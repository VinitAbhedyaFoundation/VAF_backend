import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt-strategy';
import { CsrfService } from './csrf/csrf.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,

  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    CsrfService,
  ],

  // ✅ ADDED (IMPORTANT)
  exports: [AuthService, CsrfService],
})
export class AuthModule { }