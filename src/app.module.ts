import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Feature modules
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { DriveModule } from './drive/drive.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    // ✅ Global Config
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ✅ Rate Limiting (Production-ready)
    ThrottlerModule.forRoot([
      {
        ttl: 60,   // 1 minute
        limit: 10, // 10 requests per minute
      },
    ]),

    // ✅ JWT Config (IMPORTANT)
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'supersecret', // fallback
        signOptions: {
          expiresIn: '1d',
        },
      }),
    }),

    // ✅ Core modules
    DatabaseModule,

    // ✅ Feature modules
    AuthModule,
    UserModule,
    DriveModule,
    DashboardModule,
  ],

  providers: [
    // ✅ Global Rate Limit Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}