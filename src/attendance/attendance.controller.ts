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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
  ) {}

  // 🔹 Get all attendance records
  @Get('all')
  getAll() {
    return this.service.getAll();
  }

  // 🔹 Join a drive
  @Post('mark')
  mark(
    @Req() req: any,
    @Body() body: { driveId: number },
  ) {
    console.log('====================');
    console.log('ATTENDANCE MARK');
    console.log('USER:', req.user);
    console.log('BODY:', body);
    console.log('USER ID:', req.user?.id);
    console.log('USER SUB:', req.user?.sub);
    console.log('====================');

    return this.service.markAttendance(
      req.user?.sub,
      body.driveId,
    );
  }

  // 🔹 Approve attendance (Admin only)
  @Patch('approve/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'SuperAdmin')
  approve(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.service.approveAttendance(id);
  }

  // 🔹 Get logged-in user's attendance
  @Get('my')
  getMyAttendance(
    @Req() req: any,
  ) {
    console.log('GET MY ATTENDANCE USER:', req.user);

    return this.service.getMyAttendance(
      req.user?.id,
    );
  }
}