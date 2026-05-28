import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';

import { UserService } from './user.service';
import { UserId } from '../common/decorator/user-id.decorator';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { MarkAttendanceDto } from './dto/mark-attendance.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  // =========================
  // USER DETAILS
  // =========================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User, Role.Admin, Role.SuperAdmin)
  @Get('details')
  @ApiOperation({ summary: 'Get current logged-in user details' })
  userDetail(@UserId() userId: number) {
    return this.userService.getUserById(userId);
  }

  // =========================
  // ADMIN GET USER
  // =========================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Get('details/:ploggerId')
  @ApiOperation({ summary: 'Get user by ploggerId' })
  getUserByPloggerId(
    @Param('ploggerId') ploggerId: string,
  ) {
    return this.userService.getUserByPloggerId(ploggerId);
  }

  // =========================
  // GET ALL USERS
  // =========================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Get('all')
  @ApiOperation({ summary: 'Get all users' })
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  // =========================
  // SEARCH USERS
  // =========================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  searchUsers(@Query('q') query: string) {
    return this.userService.searchUsers(query);
  }

  // =========================
  // APPROVE USER
  // =========================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin, Role.Admin)
  @Patch('approve/:id')
  @ApiOperation({ summary: 'Approve user' })
  approveUser(@Param('id') id: string) {
    return this.userService.approveUser(Number(id));
  }

  // =========================
  // SUSPEND USER
  // =========================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin, Role.Admin)
  @Patch('suspend/:id')
  @ApiOperation({ summary: 'Suspend user' })
  suspendUser(@Param('id') id: string) {
    return this.userService.suspendUser(Number(id));
  }
  // =========================
  // DELETE USER
  // =========================
  @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin)
@Delete(':id')
@ApiOperation({
  summary: 'Delete user/admin',
})
deleteUser(
  @Param('id') id: string,
) {
  return this.userService.deleteUser(
    Number(id),
  );
}

  // =========================
  // PROMOTE USER
  // =========================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  @Patch('promote/:id')
  @ApiOperation({ summary: 'Promote user to admin' })
  promoteUser(@Param('id') id: string) {
    return this.userService.promoteUser(Number(id));
  }

  // =========================
// MARK ATTENDANCE
// =========================

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.User)
@Post('attendance')
@ApiOperation({ summary: 'Submit attendance request' })
markAttendance(
  @Body() markAttendanceData: MarkAttendanceDto,
  @UserId() userId: number,
) {
  return this.userService.markAttendance(
    markAttendanceData.temporaryToken,
    userId,
  );
}

// =========================
// GET PENDING ATTENDANCE
// =========================

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
@Get('attendance/pending')
@ApiOperation({ summary: 'Get pending attendance records' })
getPendingAttendance() {
  return this.userService.getPendingAttendance();
}

// =========================
// APPROVE ATTENDANCE
// =========================

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
@Patch('attendance/approve/:id')
@ApiOperation({ summary: 'Approve attendance' })
approveAttendance(
  @Param('id') id: string,
) {
  return this.userService.approveAttendance(
    Number(id),
  );
}

// =========================
// REJECT ATTENDANCE
// =========================

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
@Patch('attendance/reject/:id')
@ApiOperation({ summary: 'Reject attendance' })
rejectAttendance(
  @Param('id') id: string,
) {
  return this.userService.rejectAttendance(
    Number(id),
  );
}

  // =========================
  // DRIVES ATTENDED
  // =========================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  @Get('drivesattended')
  @ApiOperation({ summary: 'Get drives attended' })
  drivesAttended(@UserId() userId: number) {
    return this.userService.drivesAttended(userId);
  }
}