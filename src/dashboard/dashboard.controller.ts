import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMyDashboard(@Req() req: Request) {
    const user = req.user as { sub: number };

    if (!user?.sub) {
      throw new Error('Invalid user token');
    }

    return this.dashboardService.getUserDashboard(user.sub);
  }
}