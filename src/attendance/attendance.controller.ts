import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

@Controller('attendance')
export class AttendanceController {
  constructor(private service: AttendanceService) { }

  @Get('all')
  getAll() {
    return this.service.getAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark')
  mark(
    @Req() req: any,
    @Body() body: { driveId: number },
  ) {
    return this.service.markAttendance(
      req.user.id,
      body.driveId,
    );
  }

  @Patch('approve/:id')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.service.approveAttendance(id);
  }
  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyAttendance(
    @Req() req: any,
  ) {
    return this.service.getMyAttendance(
      req.user.id,
    );
  }
}