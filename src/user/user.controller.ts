import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UserId } from '../common/decorator/user-id.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

// ✅ IMPORT YOUR GUARDS
import { UserAuthGuard } from '../auth/guards/user-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 🔐 Get own user details
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  @Get('details')
  @ApiOperation({
    description: 'Get User Details',
    summary: 'Input - User Token , output - User details',
  })
  async userDetail(@UserId() userId: number) {
    return this.userService.userDetail(userId);
  }

  // 🔐 Admin can fetch any user
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  @Get('details/:id')
  @ApiOperation({
    description: 'Get User Details by Id (for admin)',
    summary: 'Input - User Id + Admin Token , output - User details',
  })
  async getUserById(@Param('id') id: string) {
    return this.userService.userDetail(+id);
  }

  // 🔐 Mark attendance
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  @Post('attendance')
  @ApiOperation({
    description: 'Mark Attendance',
    summary: 'Input - Temporary Token + User Token , output - Success message',
  })
  async markAttendance(
    @Body() markAttendanceData: MarkAttendanceDto,
    @UserId() userId: number,
  ) {
    return this.userService.markAttendance(
      markAttendanceData.temporaryToken,
      userId,
    );
  }

  // 🔐 Get drives attended
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  @Get('drivesattended')
  @ApiOperation({
    description: 'Get Drives Attended',
    summary: 'Input - User Token , output - Drives list',
  })
  async drivesAttended(@UserId() userId: number) {
    return this.userService.drivesAttended(userId);
  }
}