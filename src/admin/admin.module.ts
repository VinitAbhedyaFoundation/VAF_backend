import { Module } from '@nestjs/common';
import { AdminController } from 'src/admin/admin.controller';
import { AdminService } from 'src/admin/admin.service';
import { UserModule } from 'src/user/user.module';
import { DriveModule } from 'src/drive/drive.module';

@Module({
  imports: [UserModule, DriveModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}