import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserId } from '../common/decorator/user-id.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 🔐 USER: Get own details (internal id)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('User', 'Admin', 'SuperAdmin')
  @Get('details')
  @ApiOperation({ description: 'Get current logged-in user details' })
  userDetail(@UserId() userId: number) {
    return this.userService.getUserById(userId);
  }

  // 🔐 ADMIN: Get user by ploggerId
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'SuperAdmin')
  @Get('details/:ploggerId')
  @ApiOperation({ description: 'Get user by ploggerId (Admin only)' })
  getUserByPloggerId(@Param('ploggerId') ploggerId: string) {
    return this.userService.getUserByPloggerId(ploggerId);
  }

  // 🔐 ADMIN: Get all users (IMPORTANT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'SuperAdmin')
  @Get('all')
  @ApiOperation({ description: 'Get all users (Admin)' })
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  // 🔐 ADMIN: Search users (IMPORTANT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'SuperAdmin')
  @Get('search')
  @ApiOperation({ description: 'Search users (Admin)' })
  searchUsers(@Query('q') query: string) {
    return this.userService.searchUsers(query);
  }

  // 🔐 USER: Mark attendance
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('User')
  @Post('attendance')
  @ApiOperation({ description: 'Mark Attendance' })
  markAttendance(
    @Body() markAttendanceData: MarkAttendanceDto,
    @UserId() userId: number,
  ) {
    return this.userService.markAttendance(
      markAttendanceData.temporaryToken,
      userId,
    );
  }

  // 🔐 USER: Get drives attended
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('User')
  @Get('drivesattended')
  @ApiOperation({ description: 'Get Drives Attended' })
  drivesAttended(@UserId() userId: number) {
    return this.userService.drivesAttended(userId);
  }
}