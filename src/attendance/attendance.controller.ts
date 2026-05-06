import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private service: AttendanceService) {}

  @Get('all')
  getAll() {
    return this.service.getAll();
  }

  @Post('mark')
  mark(@Body() body: { userId: number; driveId: number }) {
    return this.service.markAttendance(body.userId, body.driveId);
  }

  @Patch('approve/:id')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.service.approveAttendance(id);
  }
}