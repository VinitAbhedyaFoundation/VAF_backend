import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({
    summary: 'Get logged-in user dashboard',
    description:
      'Returns dashboard data for the authenticated user.',
  })
  async getMyDashboard(
    @Req() req: Request,
  ) {
    const user = req.user as {
      sub: number;
    };

    if (!user?.sub) {
      throw new UnauthorizedException(
        'Invalid user token',
      );
    }

    return this.dashboardService.getUserDashboard(
      user.sub,
    );
  }
}