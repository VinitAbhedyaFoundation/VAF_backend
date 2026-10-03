import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Role } from '@prisma/client';

import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface DashboardStats {
  totalVolunteers: number;
  totalDrives: number;
}

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Get('dashboard-stats')
  @ApiOperation({
    summary: 'Get dashboard statistics',
  })
  @ApiResponse({
    status: 200,
    description:
      'Dashboard statistics retrieved successfully.',
  })
  async getDashboardStats(): Promise<DashboardStats> {
    return this.adminService.getDashboardStats();
  }
}