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

    user: {
      findMany: jest.Mock;
    };
    notification: {
      createMany: jest.Mock;
    };

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

    guestVolunteer: {

      create: jest.Mock;

      findMany: jest.Mock;

      findUnique: jest.Mock;

      update: jest.Mock;

    };

  };

  beforeEach(async () => {

    database = {

      user: {
        findMany: jest.fn(),
      },
      notification: {
        createMany: jest.fn(),
      },

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

      guestVolunteer: {

        create: jest.fn(),

        findMany: jest.fn(),

        findUnique: jest.fn(),

        update: jest.fn(),

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

      const createdDrive = {
        id: 1,
        ...dto,
        driveLocation: { location: dto.location },
      };
      database.drive.create.mockResolvedValue(createdDrive);

      database.user.findMany.mockResolvedValue([
        { id: 10 },
        { id: 11 },
      ]);

      database.notification.createMany.mockResolvedValue({
        count: 2,
      });

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

      expect(database.user.findMany).toHaveBeenCalledWith({
        where: {
          status: 'Approved',
        },
        select: {
          id: true,
        },
      });

      expect(database.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: 10,
            title: 'New Drive Available',
          }),
          expect.objectContaining({
            userId: 11,
            title: 'New Drive Available',
          }),
        ],
      });

    });

    it('does not create notifications when there are no approved users', async () => {
      const dto = {
        title: 'Tree Plantation Drive',
        location: 'Pune, Maharashtra',
        date: new Date('2026-07-10T08:00:00.000Z'),
        totalHours: 4,
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        description: 'Community cleanup',
      };

      database.drive.create.mockResolvedValue({
        id: 1,
        ...dto,
        driveLocation: {
          location: dto.location,
        },
      });

      database.user.findMany.mockResolvedValue([]);

      const result = await service.createDrive(dto);

      expect(result.message).toBe('Drive Created Successfully');
      expect(database.notification.createMany).not.toHaveBeenCalled();
    });

    it('creates the drive successfully even if notification creation fails', async () => {
      const dto = {
        title: 'Tree Plantation Drive',
        location: 'Pune, Maharashtra',
        date: new Date('2026-07-10T08:00:00.000Z'),
        totalHours: 4,
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        description: 'Community cleanup',
      };

      const createdDrive = {
        id: 1,
        ...dto,
        driveLocation: { location: dto.location },
      };

      database.drive.create.mockResolvedValue(createdDrive);
      database.user.findMany.mockResolvedValue([
        { id: 10 },
        { id: 11 },
      ]);
      database.notification.createMany.mockRejectedValue(
        new Error('Notification service unavailable'),
      );
      const loggerErrorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      const result = await service.createDrive(dto);

      expect(database.drive.create).toHaveBeenCalled();
      expect(database.notification.createMany).toHaveBeenCalled();

      expect(result).toEqual({
        message: 'Drive Created Successfully',
        drive: createdDrive,
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Drive created successfully, but notification creation failed.',
        expect.any(String),
      );
      loggerErrorSpy.mockRestore();
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

      database.drive.findUnique.mockResolvedValue({
        id: 1,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        completed: false,
      });
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

      database.drive.findUnique.mockResolvedValue(null);

      await expect(

        service.update(999, { title: 'Updated' }),

      ).rejects.toThrow(NotFoundException);

      expect(database.drive.update).not.toHaveBeenCalled();

    });

    it('rejects editing a drive that has already started', async () => {

      database.drive.findUnique.mockResolvedValue({
        id: 1,
        date: new Date(Date.now() - 60 * 60 * 1000),
        completed: false,
      });

      await expect(
        service.update(1, { title: 'Updated Drive' }),
      ).rejects.toThrow(BadRequestException);

      expect(database.drive.update).not.toHaveBeenCalled();

    });

    it('rejects editing a completed drive', async () => {

      database.drive.findUnique.mockResolvedValue({
        id: 1,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        completed: true,
      });

      await expect(
        service.update(1, { title: 'Updated Drive' }),
      ).rejects.toThrow(BadRequestException);

      expect(database.drive.update).not.toHaveBeenCalled();

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
    const makeDrive = (
      id: number,
      date: Date,
      totalHours = 2,
    ) => ({
      id,
      title: `Drive ${id}`,
      initiative: Initiative.SOCIAL_SHELF,
      description: 'Test drive',
      date,
      totalHours,
      completed: false,
      driveLocation: { location: 'Pune' },
      participations: [
        { id: 1 },
        { id: 2 },
      ],
    });

    it('returns upcoming drives with approved volunteer counts', async () => {
      database.drive.findMany.mockResolvedValue([
        makeDrive(1, new Date(Date.now() + 24 * 60 * 60 * 1000), 3),
      ]);

      const result = await service.getUpcomingDrives();

      expect(database.drive.findMany).toHaveBeenCalledWith({
        orderBy: { date: 'asc' },
        include: {
          driveLocation: {
            select: { location: true },
          },
          participations: {
            where: { status: 'Approved' },
            select: { id: true },
          },
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 1,
          title: 'Drive 1',
          location: 'Pune',
          volunteerCount: 2,
          status: 'Upcoming',
          joinable: true,
        }),
      );
    });

    it('includes an ongoing drive', async () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000);

      database.drive.findMany.mockResolvedValue([
        makeDrive(2, startTime, 3),
      ]);

      const result = await service.getUpcomingDrives();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 2,
          status: 'Ongoing',
          joinable: true,
        }),
      );
    });

    it('includes a recently ended drive within the two-hour grace period', async () => {
      // Started 3 hours ago and lasted 2 hours:
      // ended 1 hour ago, so it is still joinable.
      const startTime = new Date(Date.now() - 3 * 60 * 60 * 1000);

      database.drive.findMany.mockResolvedValue([
        makeDrive(3, startTime, 2),
      ]);

      const result = await service.getUpcomingDrives();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 3,
          status: 'Recently Ended',
          joinable: true,
        }),
      );
    });

    it('excludes a drive after its two-hour grace period expires', async () => {
      // Started 5 hours ago and lasted 2 hours:
      // ended 3 hours ago, so the joining window has expired.
      const startTime = new Date(Date.now() - 5 * 60 * 60 * 1000);

      database.drive.findMany.mockResolvedValue([
        makeDrive(4, startTime, 2),
      ]);

      const result = await service.getUpcomingDrives();

      expect(result).toEqual([]);
    });

    it('queries drives without excluding completed drives so grace-period drives remain visible', async () => {
      database.drive.findMany.mockResolvedValue([]);

      await service.getUpcomingDrives();

      expect(database.drive.findMany).toHaveBeenCalledWith({
        orderBy: { date: 'asc' },
        include: {
          driveLocation: {
            select: { location: true },
          },
          participations: {
            where: { status: 'Approved' },
            select: { id: true },
          },
        },
      });
    });

    it('wraps unexpected database errors', async () => {
      const loggerErrorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      database.drive.findMany.mockRejectedValue(
        new Error('Database failure'),
      );

      await expect(service.getUpcomingDrives()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Fetch upcoming drives failed',
        expect.any(String),
      );

      loggerErrorSpy.mockRestore();
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

  describe('registerGuestVolunteer', () => {

    it('registers a guest volunteer successfully', async () => {
      const dto = {
        driveId: 4,
        name: 'Rahul Sharma',
      };

      const guestVolunteer = {
        id: 1,
        driveId: 4,
        name: 'Rahul Sharma',
        hours: 0,
        waste: 0,
      };

      database.drive.findUnique.mockResolvedValue({ id: 4 });
      database.guestVolunteer.create.mockResolvedValue(guestVolunteer);

      const result = await service.registerGuestVolunteer(dto);

      expect(database.drive.findUnique).toHaveBeenCalledWith({
        where: { id: 4 },
        select: { id: true },
      });

      expect(database.guestVolunteer.create).toHaveBeenCalledWith({
        data: {
          driveId: 4,
          name: 'Rahul Sharma',
        },
      });

      expect(result).toEqual({
        message: 'Guest volunteer registered successfully',
        guestVolunteer,
      });
    });

    it('trims whitespace from the guest name', async () => {
      database.drive.findUnique.mockResolvedValue({ id: 4 });
      database.guestVolunteer.create.mockResolvedValue({
        id: 2,
        driveId: 4,
        name: 'Rahul Sharma',
      });

      await service.registerGuestVolunteer({
        driveId: 4,
        name: '  Rahul Sharma  ',
      });

      expect(database.guestVolunteer.create).toHaveBeenCalledWith({
        data: {
          driveId: 4,
          name: 'Rahul Sharma',
        },
      });
    });

    it('rejects an empty guest name', async () => {
      await expect(
        service.registerGuestVolunteer({
          driveId: 4,
          name: '   ',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(database.drive.findUnique).not.toHaveBeenCalled();
      expect(database.guestVolunteer.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid drive ID', async () => {
      await expect(
        service.registerGuestVolunteer({
          driveId: 0,
          name: 'Rahul Sharma',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(database.drive.findUnique).not.toHaveBeenCalled();
      expect(database.guestVolunteer.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the drive does not exist', async () => {
      database.drive.findUnique.mockResolvedValue(null);

      await expect(
        service.registerGuestVolunteer({
          driveId: 999,
          name: 'Rahul Sharma',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(database.guestVolunteer.create).not.toHaveBeenCalled();
    });

    it('wraps unexpected database errors', async () => {
      const loggerErrorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      database.drive.findUnique.mockResolvedValue({ id: 4 });
      database.guestVolunteer.create.mockRejectedValue(
        new Error('Database failure'),
      );

      await expect(
        service.registerGuestVolunteer({
          driveId: 4,
          name: 'Rahul Sharma',
        }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Guest volunteer registration failed',
        expect.any(String),
      );

      loggerErrorSpy.mockRestore();
    });

  });

  describe('getGuestVolunteers', () => {

    it('returns guest volunteers for an existing drive', async () => {

      const guests = [

        {

          id: 1,

          driveId: 4,

          name: 'Rahul Sharma',

          hours: 0,

          waste: 0,

          createdAt: new Date('2026-10-23T08:00:00.000Z'),

        },

      ];

      database.drive.findUnique.mockResolvedValue({ id: 4 });

      database.guestVolunteer.findMany.mockResolvedValue(guests);

      const result = await service.getGuestVolunteers(4);

      expect(database.drive.findUnique).toHaveBeenCalledWith({

        where: { id: 4 },

        select: { id: true },

      });

      expect(database.guestVolunteer.findMany).toHaveBeenCalledWith({

        where: { driveId: 4 },

        orderBy: { createdAt: 'asc' },

        select: {

          id: true,

          driveId: true,

          name: true,

          hours: true,

          waste: true,

          createdAt: true,

        },

      });

      expect(result).toEqual(guests);

    });

    it('returns an empty array when a drive has no guests', async () => {

      database.drive.findUnique.mockResolvedValue({ id: 4 });

      database.guestVolunteer.findMany.mockResolvedValue([]);

      await expect(service.getGuestVolunteers(4)).resolves.toEqual([]);

    });

    it('rejects an invalid drive ID', async () => {

      await expect(service.getGuestVolunteers(0)).rejects.toThrow(

        BadRequestException,

      );

      expect(database.drive.findUnique).not.toHaveBeenCalled();

      expect(database.guestVolunteer.findMany).not.toHaveBeenCalled();

    });

    it('returns 404 when the drive does not exist', async () => {

      database.drive.findUnique.mockResolvedValue(null);

      await expect(service.getGuestVolunteers(999)).rejects.toThrow(

        NotFoundException,

      );

      expect(database.guestVolunteer.findMany).not.toHaveBeenCalled();

    });

    it('wraps unexpected database errors', async () => {

      const loggerErrorSpy = jest

        .spyOn(service['logger'], 'error')

        .mockImplementation(() => undefined);

      database.drive.findUnique.mockResolvedValue({ id: 4 });

      database.guestVolunteer.findMany.mockRejectedValue(

        new Error('Database failure'),

      );

      await expect(service.getGuestVolunteers(4)).rejects.toThrow(

        InternalServerErrorException,

      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(

        'Fetch guest volunteers failed',

        expect.any(String),

      );

      loggerErrorSpy.mockRestore();

    });

  });

  describe('updateGuestVolunteer', () => {

    const ploggersGuest = {

      id: 2,

      drive: { initiative: Initiative.SAMBHAJINAGAR_PLOGGERS },

    };

    it('updates hours only and leaves waste unchanged', async () => {

      const updatedGuest = {

        id: 2,

        driveId: 4,

        name: 'Walk-in Volunteer',

        hours: 3,

        waste: 0,

      };

      database.guestVolunteer.findUnique.mockResolvedValue(ploggersGuest);

      database.guestVolunteer.update.mockResolvedValue(updatedGuest);

      const result = await service.updateGuestVolunteer(2, { hours: 3 });

      expect(database.guestVolunteer.findUnique).toHaveBeenCalledWith({

        where: { id: 2 },

        select: { id: true, drive: { select: { initiative: true } } },

      });

      expect(database.guestVolunteer.update).toHaveBeenCalledWith({

        where: { id: 2 },

        data: { hours: 3 },

      });

      expect(result).toEqual({

        message: 'Guest volunteer updated successfully',

        guestVolunteer: updatedGuest,

      });

    });

    it('updates waste only for a Sambhajinagar Ploggers drive', async () => {

      const updatedGuest = {

        id: 2,

        driveId: 4,

        name: 'Walk-in Volunteer',

        hours: 0,

        waste: 2,

      };

      database.guestVolunteer.findUnique.mockResolvedValue(ploggersGuest);

      database.guestVolunteer.update.mockResolvedValue(updatedGuest);

      const result = await service.updateGuestVolunteer(2, { waste: 2 });

      expect(database.guestVolunteer.update).toHaveBeenCalledWith({

        where: { id: 2 },

        data: { waste: 2 },

      });

      expect(result.guestVolunteer).toEqual(updatedGuest);

    });

    it('updates hours and waste together for a Ploggers guest', async () => {

      database.guestVolunteer.findUnique.mockResolvedValue(ploggersGuest);

      database.guestVolunteer.update.mockResolvedValue({

        id: 2,

        hours: 3,

        waste: 2,

      });

      await service.updateGuestVolunteer(2, { hours: 3, waste: 2 });

      expect(database.guestVolunteer.update).toHaveBeenCalledWith({

        where: { id: 2 },

        data: { hours: 3, waste: 2 },

      });

    });

    it('rejects waste updates for non-Ploggers drives', async () => {

      database.guestVolunteer.findUnique.mockResolvedValue({

        id: 2,

        drive: { initiative: Initiative.SOCIAL_SHELF },

      });

      await expect(

        service.updateGuestVolunteer(2, { waste: 2 }),

      ).rejects.toThrow(BadRequestException);

      expect(database.guestVolunteer.update).not.toHaveBeenCalled();

    });

    it('rejects an empty update', async () => {

      await expect(

        service.updateGuestVolunteer(2, {}),

      ).rejects.toThrow(BadRequestException);

      expect(database.guestVolunteer.findUnique).not.toHaveBeenCalled();

      expect(database.guestVolunteer.update).not.toHaveBeenCalled();

    });

    it.each([

      { hours: -1 },

      { hours: 1.5 },

      { waste: -1 },

      { waste: 1.5 },

    ])('rejects invalid update values: %o', async (dto) => {

      await expect(

        service.updateGuestVolunteer(2, dto),

      ).rejects.toThrow(BadRequestException);

      expect(database.guestVolunteer.findUnique).not.toHaveBeenCalled();

      expect(database.guestVolunteer.update).not.toHaveBeenCalled();

    });

    it('rejects an invalid guest ID', async () => {

      await expect(

        service.updateGuestVolunteer(0, { hours: 1 }),

      ).rejects.toThrow(BadRequestException);

      expect(database.guestVolunteer.findUnique).not.toHaveBeenCalled();

    });

    it('returns 404 when the guest does not exist', async () => {

      database.guestVolunteer.findUnique.mockResolvedValue(null);

      await expect(

        service.updateGuestVolunteer(999, { hours: 1 }),

      ).rejects.toThrow(NotFoundException);

      expect(database.guestVolunteer.update).not.toHaveBeenCalled();

    });

    it('returns 404 when the guest disappears before the update', async () => {

      database.guestVolunteer.findUnique.mockResolvedValue(ploggersGuest);

      database.guestVolunteer.update.mockRejectedValue({

        code: 'P2025',

        message: 'Record not found',

      });

      await expect(

        service.updateGuestVolunteer(2, { hours: 1 }),

      ).rejects.toThrow(NotFoundException);

    });

    it('wraps unexpected database errors', async () => {

      const loggerErrorSpy = jest

        .spyOn(service['logger'], 'error')

        .mockImplementation(() => undefined);

      database.guestVolunteer.findUnique.mockRejectedValue(

        new Error('Database failure'),

      );

      await expect(

        service.updateGuestVolunteer(2, { hours: 1 }),

      ).rejects.toThrow(InternalServerErrorException);

      expect(loggerErrorSpy).toHaveBeenCalledWith(

        'Update guest volunteer failed',

        expect.any(String),

      );

      loggerErrorSpy.mockRestore();

    });

  });

});
