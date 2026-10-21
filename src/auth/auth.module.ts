import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt-strategy';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,

  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
  ],

  // ✅ ADDED (IMPORTANT)
  exports: [AuthService],
})
export class AuthModule { }