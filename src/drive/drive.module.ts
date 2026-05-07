import { Module } from '@nestjs/common';
import { DriveService } from './drive.service';
import { DriveController } from './drive.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DriveController],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}
