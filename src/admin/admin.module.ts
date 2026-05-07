import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserModule } from '../user/user.module';
import { DriveModule } from '../drive/drive.module';

@Module({
  imports: [UserModule, DriveModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}