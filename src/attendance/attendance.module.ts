import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DatabaseModule } from 'src/database/database.module'; // ✅ add this

@Module({
  imports: [DatabaseModule], // ✅ REQUIRED
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}