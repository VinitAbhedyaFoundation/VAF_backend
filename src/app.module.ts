import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DriveModule } from './drive/drive.module';
import { AdminModule } from './admin/admin.module';

// ✅ ADD THESE
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AttendanceModule } from './attendance/attendance.module';
import { MessageModule } from './message/message.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    AdminModule,
    UserModule,
    AuthModule,
    DatabaseModule,
    AttendanceModule,
    MessageModule,
    MailModule,

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ✅ RATE LIMITER
  ThrottlerModule.forRoot({
  throttlers: [
    {
      ttl: 60,
      limit: 10,
    },
  ],
}),

    DriveModule,
  ],

  controllers: [],

  // ✅ ADD THIS
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}