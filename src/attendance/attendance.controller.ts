import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ScanAttendanceDto } from './dto/scan-attendance.dto';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JoinDriveDto } from './dto/join-drive.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ApproveAttendanceDto } from './dto/approve-attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
  ) { }

  // Get all attendance records
  @Get('all')
  @ApiOperation({
    summary: 'Get all attendance records',
  })
  getAll() {
    return this.service.getAll();
  }

  // Join a drive
  @Post('join')
  @ApiOperation({
    summary: 'Join a drive',
  })
  joinDrive(
    @Req() req: any,
    @Body() body: JoinDriveDto,
  ) {
    return this.service.joinDrive(
      req.user.sub,
      body.driveId,
    );
  }

  // Mark attendance
  @Post('mark')
  @ApiOperation({
    summary: 'Mark attendance for a drive',
  })
  markAttendance(
    @Req() req: any,
    @Body() body: MarkAttendanceDto,
  ) {
    return this.service.markAttendance(
      req.user.sub,
      body.driveId,
    );
  }

@Post('scan')
@UseGuards(RolesGuard)
@Roles('Admin', 'SuperAdmin')
@ApiOperation({
  summary: 'Scan volunteer QR and mark attendance',
})
scanAttendance(
  @Body() dto: ScanAttendanceDto,
) {
  return this.service.scanAttendance(
    dto.participationId,
  );
}

  // Approve attendance (Admin/SuperAdmin)
  @Patch('approve/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({
    summary: 'Approve attendance',
  })
  approve(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    body: ApproveAttendanceDto,
  ) {
    return this.service.approveAttendance(
      id,
      body.hours,
      body.waste,
    );
  }

  // Logged-in user's attendance
  @Get('my')
  @ApiOperation({
    summary: 'Get logged-in user attendance',
  })
  getMyAttendance(
    @Req() req: any,
  ) {
    return this.service.getMyAttendance(
      req.user.sub,
    );
  }
}