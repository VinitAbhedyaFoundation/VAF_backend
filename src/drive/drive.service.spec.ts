
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Initiative, Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';
import { DriveService } from './drive.service';

describe('DriveService', () => {
  let service: DriveService;

  let database: {
    drive: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    driveLocation: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    database = {
      drive: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      driveLocation: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriveService,
        {
          provide: DatabaseService,
          useValue: database,
        },
      ],
    }).compile();

    service = module.get<DriveService>(DriveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDrive', () => {
    it('creates a drive and preserves its scheduled date and time', async () => {
      const date = new Date('2026-07-10T08:00:00.000Z');

      const dto = {
        title: 'Tree Plantation Drive',
        location: 'Pune, Maharashtra',
        date,
        totalHours: 4,
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        description: 'Community cleanup',
      };

      const createdDrive = { id: 1, ...dto };

      database.drive.create.mockResolvedValue(createdDrive);

      const result = await service.createDrive(dto);

      expect(database.drive.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: dto.title,
            initiative: dto.initiative,
            description: dto.description,
            date,
            totalHours: dto.totalHours,
            temporaryToken: expect.any(String),
            driveLocation: {
              connectOrCreate: {
                where: { location: dto.location },
                create: { location: dto.location },
              },
            },
          }),
        }),
      );

      expect(result.message).toBe('Drive Created Successfully');
      expect(result.drive).toEqual(createdDrive);
    });

    it('rejects an invalid date', async () => {
      await expect(
        service.createDrive({
          title: 'Drive',
          location: 'Pune',
          date: new Date('invalid'),
          totalHours: 2,
          initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(database.drive.create).not.toHaveBeenCalled();
    });

    it('wraps unexpected database errors', async () => {
      const loggerErrorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      database.drive.create.mockRejectedValue(
        new Error('Database failure'),
      );

      await expect(
        service.createDrive({
          title: 'Drive',
          location: 'Pune',
          date: new Date('2026-07-10T08:00:00.000Z'),
          totalHours: 2,
          initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Create drive failed',
        expect.any(String),
      );

      loggerErrorSpy.mockRestore();
    });
  });

  describe('createDriveLocation', () => {
    it('creates and returns a location', async () => {
      const location = { id: 1, location: 'Pune, Maharashtra' };

      database.driveLocation.create.mockResolvedValue(location);

      const result = await service.createDriveLocation({
        location: location.location,
      });

      expect(database.driveLocation.create).toHaveBeenCalledWith({
        data: { location: location.location },
        select: { id: true, location: true },
      });

      expect(result.data).toEqual(location);
    });

    it('returns a conflict when Prisma reports a duplicate location', async () => {
      database.driveLocation.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: 'test',
          },
        ),
      );

      await expect(
        service.createDriveLocation({ location: 'Pune' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllDrives', () => {
    it('returns drives with approved volunteer counts', async () => {
      database.drive.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Tree Plantation',
          initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
          description: 'Community cleanup',
          date: new Date('2026-07-10T08:00:00.000Z'),
          totalHours: 4,
          totalWasteKg: 12,
          completed: false,
          driveLocation: { location: 'Pune' },
          participations: [
            { hours: 2, status: 'Approved' },
            { hours: 3, status: 'Pending' },
            { hours: 1, status: 'Approved' },
          ],
        },
      ]);

      const result = await service.findAllDrives(1, 10);

      expect(database.drive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 1,
          volunteerCount: 2,
          wasteKg: 12,
          totalWasteKg: 12,
          location: 'Pune',
          completed: false,
        }),
      );
    });

    it('rejects invalid pagination', async () => {
      await expect(service.findAllDrives(0, 10)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.findAllDrives(1, 0)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.findAllDrives(1.5, 10)).rejects.toThrow(
        BadRequestException,
      );

      expect(database.drive.findMany).not.toHaveBeenCalled();
    });

    it('caps the page size at 50', async () => {
      database.drive.findMany.mockResolvedValue([]);

      await service.findAllDrives(2, 100);

      expect(database.drive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 50 }),
      );
    });
  });

  describe('findAllLocations', () => {
    it('returns paginated locations', async () => {
      const locations = [{ id: 1, location: 'Pune' }];

      database.driveLocation.findMany.mockResolvedValue(locations);

      const result = await service.findAllLocations(1, 10);

      expect(database.driveLocation.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
        select: { id: true, location: true },
      });

      expect(result).toEqual(locations);
    });

    it('rejects invalid pagination', async () => {
      await expect(service.findAllLocations(0, 10)).rejects.toThrow(
        BadRequestException,
      );

      expect(database.driveLocation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns a drive with its approved volunteer count', async () => {
      database.drive.findUnique.mockResolvedValue({
        id: 1,
        title: 'Tree Plantation',
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        description: 'Community cleanup',
        date: new Date('2026-07-10T08:00:00.000Z'),
        totalHours: 4,
        totalWasteKg: 5,
        completed: false,
        driveLocation: { location: 'Pune' },
        participations: [
          { hours: 2, status: 'Approved' },
          { hours: 3, status: 'Pending' },
          { hours: 1, status: 'Approved' },
        ],
      });

      const result = await service.findOne(1);

      expect(database.drive.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          title: 'Tree Plantation',
          totalWasteKg: 5,
          location: 'Pune',
          volunteerCount: 2,
        }),
      );
    });

    it('rejects an invalid ID', async () => {
      await expect(service.findOne(0)).rejects.toThrow(
        BadRequestException,
      );

      expect(database.drive.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the drive does not exist', async () => {
      database.drive.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates a drive including initiative and description', async () => {
      const updatedDrive = {
        id: 1,
        title: 'Updated Drive',
        initiative: Initiative.LAAL_BINDI,
        description: 'Awareness session',
        driveLocation: { location: 'Pune' },
      };

      database.drive.update.mockResolvedValue(updatedDrive);

      const result = await service.update(1, {
        title: 'Updated Drive',
        initiative: Initiative.LAAL_BINDI,
        description: 'Awareness session',
      });

      expect(database.drive.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            title: 'Updated Drive',
            initiative: Initiative.LAAL_BINDI,
            description: 'Awareness session',
          }),
        }),
      );

      expect(result.drive).toEqual(updatedDrive);
    });

    it('rejects an invalid ID', async () => {
      await expect(service.update(0, {})).rejects.toThrow(
        BadRequestException,
      );

      expect(database.drive.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the drive does not exist', async () => {
      database.drive.update.mockRejectedValue({
        code: 'P2025',
        message: 'Record not found',
      });

      await expect(
        service.update(999, { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByDate', () => {

    it.each([
      {
        description: 'Completed when the drive is marked completed',
        completed: true,
        date: new Date('2026-07-10T08:00:00.000Z'),
        expectedStatus: 'Completed',
      },
      {
        description: 'Past when its date has passed and it is incomplete',
        completed: false,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        expectedStatus: 'Past',
      },
      {
        description: 'Upcoming when its date is in the future',
        completed: false,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        expectedStatus: 'Upcoming',
      },
    ])(
      'returns $expectedStatus status: $description',
      async ({ completed, date, expectedStatus }) => {
        database.drive.findMany.mockResolvedValue([
          {
            id: 1,
            title: 'Test Drive',
            date,
            totalHours: 2,
            totalWasteKg: null,
            completed,
            driveLocation: { location: 'Pune' },
            participations: [],
            initiative: Initiative.SOCIAL_SHELF,
            description: null,
          },
        ]);

        const result = await service.findByDate('2026-07-10');

        expect(result[0].status).toBe(expectedStatus);
      },
    );

    it('uses India-local day boundaries and returns matching drives', async () => {
      database.drive.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Tree Plantation',
          initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
          description: null,
          date: new Date('2026-07-10T08:30:00.000Z'),
          totalHours: 4,
          totalWasteKg: 5,
          driveLocation: { location: 'Pune' },
          participations: [
            { hours: 2, status: 'Approved' },
            { hours: 3, status: 'Pending' },
          ],
        },
      ]);

      const result = await service.findByDate('2026-07-10');

      const query = database.drive.findMany.mock.calls[0][0];
      const start = query.where.date.gte as Date;
      const end = query.where.date.lt as Date;

      // 00:00 IST on 10 July is 18:30 UTC on 9 July.
      expect(start.toISOString()).toBe('2026-07-09T18:30:00.000Z');
      expect(end.toISOString()).toBe('2026-07-10T18:30:00.000Z');
      expect(end.getTime() - start.getTime()).toBe(
        24 * 60 * 60 * 1000,
      );

      expect(result[0]).toEqual(
        expect.objectContaining({
          volunteerCount: 1,
          hours: 2,
          location: 'Pune',
        }),
      );
    });

    it.each([
      'not-a-date',
      '2026-02-30',
      '2026-13-01',
      '2026-7-10',
    ])('rejects invalid date input: %s', async (date) => {
      await expect(service.findByDate(date)).rejects.toThrow(
        BadRequestException,
      );

      expect(database.drive.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 when no drives exist for the date', async () => {
      database.drive.findMany.mockResolvedValue([]);

      await expect(
        service.findByDate('2026-07-10'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUpcomingDrives', () => {
    it('returns upcoming incomplete drives with approved volunteer counts', async () => {
      const drives = [
        {
          id: 1,
          title: 'Upcoming Drive',
          initiative: Initiative.SOCIAL_SHELF,
          description: 'Book reading club',
          date: new Date('2026-12-10T08:00:00.000Z'),
          totalHours: 3,
          completed: false,
          driveLocation: { location: 'Pune' },
          participations: [
            { hours: 2, status: 'Approved' },
            { hours: 1, status: 'Pending' },
            { hours: 2, status: 'Approved' },
          ],
        },
      ];

      database.drive.findMany.mockResolvedValue(drives);

      const result = await service.getUpcomingDrives();

      expect(database.drive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: expect.any(Date) },
            completed: false,
          }),
          orderBy: { date: 'asc' },
        }),
      );

      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 1,
          title: 'Upcoming Drive',
          location: 'Pune',
          volunteerCount: 2,
        }),
      );
    });
  });

  describe('completeDrive', () => {
    it('marks a Ploggers drive completed and stores its waste total', async () => {
      const existingDrive = {
        id: 1,
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        totalWasteKg: 0,
      };

      const completedDrive = {
        id: 1,
        completed: true,
        totalWasteKg: 12,
      };

      database.drive.findUnique.mockResolvedValue(existingDrive);
      database.drive.update.mockResolvedValue(completedDrive);

      const result = await service.completeDrive(1, 12);

      expect(database.drive.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          initiative: true,
          totalWasteKg: true,
        },
      });

      expect(database.drive.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { completed: true, totalWasteKg: 12 },
      });

      expect(result).toEqual(completedDrive);
    });

    it('allows completing a non-Ploggers drive without waste data', async () => {
      database.drive.findUnique.mockResolvedValue({
        id: 2,
        initiative: Initiative.SOCIAL_SHELF,
        totalWasteKg: null,
      });

      database.drive.update.mockResolvedValue({
        id: 2,
        completed: true,
        totalWasteKg: null,
      });

      await expect(service.completeDrive(2)).resolves.toEqual({
        id: 2,
        completed: true,
        totalWasteKg: null,
      });

      expect(database.drive.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { completed: true },
      });
    });

    it('rejects waste tracking for non-Ploggers drives', async () => {
      database.drive.findUnique.mockResolvedValue({
        id: 2,
        initiative: Initiative.SOCIAL_SHELF,
        totalWasteKg: null,
      });

      await expect(service.completeDrive(2, 5)).rejects.toThrow(
        BadRequestException,
      );

      expect(database.drive.update).not.toHaveBeenCalled();
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid waste value %s',
      async (waste) => {
        await expect(
          service.completeDrive(1, waste),
        ).rejects.toThrow(BadRequestException);

        expect(database.drive.findUnique).not.toHaveBeenCalled();
      },
    );

    it('rejects a non-number waste value', async () => {
      await expect(
        service.completeDrive(1, '12' as unknown as number),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns 404 when the drive does not exist', async () => {
      database.drive.findUnique.mockResolvedValue(null);

      await expect(
        service.completeDrive(999, 10),
      ).rejects.toThrow(NotFoundException);

      expect(database.drive.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid drive ID', async () => {
      await expect(service.completeDrive(0)).rejects.toThrow(
        BadRequestException,
      );

      expect(database.drive.findUnique).not.toHaveBeenCalled();
    });
  });
});
