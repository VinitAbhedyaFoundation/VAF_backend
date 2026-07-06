import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';

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