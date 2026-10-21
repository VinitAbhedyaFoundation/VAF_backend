import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: {
    getUserDashboard: jest.Mock;
  };

  beforeEach(async () => {
    dashboardService = {
      getUserDashboard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: dashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyDashboard', () => {
    it('should return dashboard data for the authenticated user', async () => {
      const dashboardData = {
        user: { name: 'Test User', streakWeeks: 0, certificates: 0 },
        stats: { drivesJoined: 2, hoursVolunteered: 5, wasteCollected: 10 },
        milestone: { level: 'Bronze', completed: 2 },
        recentDrives: [],
        activity: [],
        certificates: [],
      };

      dashboardService.getUserDashboard.mockResolvedValue(dashboardData);

      const result = await controller.getMyDashboard({
        user: { sub: 123 },
      } as any);

      expect(dashboardService.getUserDashboard).toHaveBeenCalledWith(123);
      expect(result).toEqual(dashboardData);
    });

    it('should throw UnauthorizedException when the user ID is missing', async () => {
      await expect(
        controller.getMyDashboard({ user: {} } as any),
      ).rejects.toThrow(UnauthorizedException);

      expect(dashboardService.getUserDashboard).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      const error = new Error('Dashboard service failed');
      dashboardService.getUserDashboard.mockRejectedValue(error);

      await expect(
        controller.getMyDashboard({ user: { sub: 123 } } as any),
      ).rejects.toThrow(error);
    });
  });
});