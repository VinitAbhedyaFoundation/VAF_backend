import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DatabaseService } from '../database/database.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    user: { findUnique: jest.Mock };
    participation: { findMany: jest.Mock };
    certificate: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      participation: { findMany: jest.fn() },
      certificate: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: DatabaseService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getUserDashboard(123)).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.participation.findMany).not.toHaveBeenCalled();
    expect(prisma.certificate.findMany).not.toHaveBeenCalled();
  });

  it('should calculate statistics from completed participations', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 123,
      name: 'Test User',
    });

    prisma.participation.findMany.mockResolvedValue([
      {
        id: 1,
        driveId: 10,
        userId: 123,
        status: 'Approved',
        attendanceMarked: true,
        hours: 3,
        waste: 5,
        createdAt: new Date('2026-10-10T10:00:00Z'),
        drive: {
          title: 'Tree Plantation',
          date: new Date('2026-10-10T10:00:00Z'),
          driveLocation: { location: 'Pune' },
        },
      },
      {
        id: 2,
        driveId: 11,
        userId: 123,
        status: 'Pending',
        attendanceMarked: false,
        hours: 4,
        waste: 8,
        createdAt: new Date('2026-10-09T10:00:00Z'),
        drive: {
          title: 'Clean-up Drive',
          date: new Date('2026-10-09T10:00:00Z'),
          driveLocation: { location: 'Pune' },
        },
      },
    ]);

    prisma.certificate.findMany.mockResolvedValue([
      {
        id: 50,
        issuedAt: new Date('2026-10-10T12:00:00Z'),
        fileUrl: 'https://example.com/certificate.pdf',
        drive: { title: 'Tree Plantation' },
      },
    ]);

    const result = await service.getUserDashboard(123);

    expect(result.stats).toEqual({
      drivesJoined: 1,
      hoursVolunteered: 3,
      wasteCollected: 5,
    });
    expect(result.user.certificates).toBe(1);
    expect(result.milestone).toEqual({
      level: 'Bronze',
      completed: 1,
    });
    expect(result.recentDrives).toHaveLength(1);
    expect(result.activity).toHaveLength(1);
    expect(prisma.participation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 123 },
      }),
    );
    expect(prisma.certificate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 123 },
      }),
    );
  });
});