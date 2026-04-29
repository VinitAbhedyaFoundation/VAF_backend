import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  getMyDashboard(@Req() req) {
    // TEMP: hardcode userId for now
    return this.dashboardService.getUserDashboard(1);
  }
}