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

  let database: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      drive: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      participation: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    database = {
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
      user: { findMany: jest.fn() },
      notification: { createMany: jest.fn() },
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
        { provide: DatabaseService, useValue: database },
      ],
    }).compile();

    service = module.get<DriveService>(DriveService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createDrive', () => {
    const dto = {
      title: 'Tree Plantation Drive',
      location: 'Pune, Maharashtra',
      date: new Date('2026-07-10T08:00:00.000Z'),
      totalHours: 4,
      initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
      description: 'Community cleanup',
    };

    it('creates a drive and notifies approved users', async () => {
      const createdDrive = {
        id: 1,
        ...dto,
        driveLocation: { location: dto.location },
      };
      database.drive.create.mockResolvedValue(createdDrive);
      database.user.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
      database.notification.createMany.mockResolvedValue({ count: 2 });

      const result = await service.createDrive(dto);

      expect(database.drive.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: dto.title,
            initiative: dto.initiative,
            description: dto.description,
            date: dto.date,
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
      expect(result).toEqual({
        message: 'Drive Created Successfully',
        drive: createdDrive,
      });
      expect(database.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ userId: 10, title: 'New Drive Available' }),
          expect.objectContaining({ userId: 11, title: 'New Drive Available' }),
        ],
      });
    });

    it('does not create notifications when there are no approved users', async () => {
      database.drive.create.mockResolvedValue({
        id: 1,
        ...dto,
        driveLocation: { location: dto.location },
      });
      database.user.findMany.mockResolvedValue([]);

      await service.createDrive(dto);

      expect(database.notification.createMany).not.toHaveBeenCalled();
    });

    it('keeps the drive when notification creation fails', async () => {
      database.drive.create.mockResolvedValue({
        id: 1,
        ...dto,
        driveLocation: { location: dto.location },
      });
      database.user.findMany.mockResolvedValue([{ id: 10 }]);
      database.notification.createMany.mockRejectedValue(new Error('failed'));
      jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

      await expect(service.createDrive(dto)).resolves.toMatchObject({
        message: 'Drive Created Successfully',
      });
    });

    it('rejects an invalid date', async () => {
      await expect(
        service.createDrive({ ...dto, date: new Date('invalid') }),
      ).rejects.toThrow(BadRequestException);
      expect(database.drive.create).not.toHaveBeenCalled();
    });

    it('wraps unexpected database errors', async () => {
      database.drive.create.mockRejectedValue(new Error('database failure'));
      jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

      await expect(service.createDrive(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createDriveLocation', () => {
    it('creates a location', async () => {
      const location = { id: 1, location: 'Pune' };
      database.driveLocation.create.mockResolvedValue(location);

      await expect(service.createDriveLocation({ location: 'Pune' })).resolves
        .toMatchObject({ data: location });
      expect(database.driveLocation.create).toHaveBeenCalledWith({
        data: { location: 'Pune' },
        select: { id: true, location: true },
      });
    });

    it('returns conflict for a duplicate location', async () => {
      database.driveLocation.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.createDriveLocation({ location: 'Pune' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllDrives', () => {
    it('returns drives with approved volunteer counts and waste totals', async () => {
      database.drive.findMany.mockResolvedValue([{
        id: 1,
        title: 'Tree Plantation',
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        description: 'Cleanup',
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
      }]);

      const result = await service.findAllDrives(1, 10);

      expect(database.drive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
      expect(result[0]).toEqual(expect.objectContaining({
        id: 1,
        volunteerCount: 2,
        wasteKg: 12,
        totalWasteKg: 12,
        location: 'Pune',
      }));
    });

    it('rejects invalid pagination and caps page size at 50', async () => {
      await expect(service.findAllDrives(0, 10)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAllDrives(1, 0)).rejects.toThrow(
        BadRequestException,
      );
      expect(database.drive.findMany).not.toHaveBeenCalled();

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

      await expect(service.findAllLocations(1, 10)).resolves.toEqual(locations);
      expect(database.driveLocation.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
        select: { id: true, location: true },
      });
    });

    it('rejects invalid pagination', async () => {
      await expect(service.findAllLocations(0, 10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('returns a drive with approved volunteer count', async () => {
      database.drive.findUnique.mockResolvedValue({
        id: 1,
        title: 'Tree Plantation',
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        description: 'Cleanup',
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

      expect(result).toEqual(expect.objectContaining({
        id: 1,
        title: 'Tree Plantation',
        totalWasteKg: 5,
        location: 'Pune',
        volunteerCount: 2,
      }));
    });

    it('rejects invalid IDs and returns 404 for missing drives', async () => {
      await expect(service.findOne(0)).rejects.toThrow(BadRequestException);
      database.drive.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updatedDrive = {
      id: 1,
      title: 'Updated Drive',
      initiative: Initiative.LAAL_BINDI,
      description: 'Awareness session',
      driveLocation: { location: 'Pune' },
    };

    it('updates a drive including initiative and description', async () => {
      database.drive.findUnique.mockResolvedValue({ id: 1 });
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

    it.each([
      ['a drive that has already started', new Date(Date.now() - 3600000), false],
      ['a drive with a past date', new Date(Date.now() - 86400000), false],
      ['a completed drive', new Date(Date.now() + 86400000), true],
    ])('allows editing %s', async (_description, date, completed) => {
      database.drive.findUnique.mockResolvedValue({ id: 1, date, completed });
      database.drive.update.mockResolvedValue({
        ...updatedDrive,
        title: 'Updated Drive',
      });

      await expect(
        service.update(1, { title: 'Updated Drive' }),
      ).resolves.toMatchObject({
        message: 'Drive Updated Successfully',
        drive: { id: 1, title: 'Updated Drive' },
      });

      expect(database.drive.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { title: 'Updated Drive' },
        }),
      );
    });

    it('allows changing a drive date to a past date', async () => {
      const pastDate = '2020-01-01T10:00:00.000Z';
      database.drive.findUnique.mockResolvedValue({ id: 1 });
      database.drive.update.mockResolvedValue(updatedDrive);

      await service.update(1, { date: new Date(pastDate) });

      expect(database.drive.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { date: new Date(pastDate) },
        }),
      );
    });

    it('rejects an invalid ID, missing drive, empty update, invalid date, and invalid hours', async () => {
      await expect(service.update(0, {})).rejects.toThrow(BadRequestException);

      database.drive.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { title: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );

      database.drive.findUnique.mockResolvedValue({ id: 1 });
      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
      await expect(service.update(1, { date: new Date('not-a-date') })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update(1, { totalHours: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByDate', () => {
    it.each([
      [true, new Date('2026-07-10T08:00:00.000Z'), 'Completed'],
      [false, new Date(Date.now() - 7 * 86400000), 'Past'],
      [false, new Date(Date.now() + 7 * 86400000), 'Upcoming'],
    ])('assigns the expected drive status', async (completed, date, status) => {
      database.drive.findMany.mockResolvedValue([{
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
      }]);

      const result = await service.findByDate('2026-07-10');
      expect(result[0].status).toBe(status);
    });

    it('uses India-local day boundaries', async () => {
      database.drive.findMany.mockResolvedValue([{
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
      }]);

      const result = await service.findByDate('2026-07-10');
      const query = database.drive.findMany.mock.calls[0][0];
      expect(query.where.date.gte.toISOString()).toBe('2026-07-09T18:30:00.000Z');
      expect(query.where.date.lt.toISOString()).toBe('2026-07-10T18:30:00.000Z');
      expect(result[0]).toEqual(expect.objectContaining({
        volunteerCount: 1,
        hours: 2,
        location: 'Pune',
      }));
    });

    it.each(['not-a-date', '2026-02-30', '2026-13-01', '2026-7-10'])(
      'rejects invalid date input %s',
      async (date) => {
        await expect(service.findByDate(date)).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('returns 404 when no drives exist for the date', async () => {
      database.drive.findMany.mockResolvedValue([]);
      await expect(service.findByDate('2026-07-10')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUpcomingDrives', () => {
    const makeDrive = (id: number, date: Date, totalHours = 2) => ({
      id,
      title: `Drive ${id}`,
      initiative: Initiative.SOCIAL_SHELF,
      description: 'Test drive',
      date,
      totalHours,
      completed: false,
      driveLocation: { location: 'Pune' },
      participations: [{ id: 1 }, { id: 2 }],
    });

    it('returns upcoming, ongoing, and recently ended drives within the grace window', async () => {
      database.drive.findMany.mockResolvedValue([
        makeDrive(1, new Date(Date.now() + 86400000), 3),
        makeDrive(2, new Date(Date.now() - 3600000), 3),
        makeDrive(3, new Date(Date.now() - 3 * 3600000), 2),
      ]);

      const result = await service.getUpcomingDrives();

      expect(result.map((drive) => drive.status)).toEqual([
        'Upcoming',
        'Ongoing',
        'Recently Ended',
      ]);
      expect(result.every((drive) => drive.joinable)).toBe(true);
    });

    it('excludes drives after the two-hour grace period', async () => {
      database.drive.findMany.mockResolvedValue([
        makeDrive(4, new Date(Date.now() - 5 * 3600000), 2),
      ]);
      await expect(service.getUpcomingDrives()).resolves.toEqual([]);
    });

    it('queries all drives without a completed filter', async () => {
      database.drive.findMany.mockResolvedValue([]);
      await service.getUpcomingDrives();
      expect(database.drive.findMany).toHaveBeenCalledWith({
        orderBy: { date: 'asc' },
        include: {
          driveLocation: { select: { location: true } },
          participations: {
            where: { status: 'Approved' },
            select: { id: true },
          },
        },
      });
    });
  });

  describe('completeDrive', () => {
    it('completes a Ploggers drive and allocates waste across approved volunteers', async () => {
      const completedDrive = {
        id: 1,
        completed: true,
        totalWasteKg: 12,
      };
      tx.drive.findUnique
        .mockResolvedValueOnce({
          id: 1,
          initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
          completed: false,
        })
        .mockResolvedValueOnce(completedDrive);
      tx.drive.updateMany.mockResolvedValue({ count: 1 });
      tx.participation.findMany.mockResolvedValue([
        { id: 10 },
        { id: 11 },
        { id: 12 },
      ]);
      tx.participation.update.mockResolvedValue({});

      const result = await service.completeDrive(1, 12);

      expect(database.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.drive.findUnique).toHaveBeenNthCalledWith(1, {
        where: { id: 1 },
        select: { id: true, initiative: true, completed: true },
      });
      expect(tx.drive.updateMany).toHaveBeenCalledWith({
        where: { id: 1, completed: false },
        data: { completed: true, totalWasteKg: 12 },
      });
      expect(tx.participation.findMany).toHaveBeenCalledWith({
        where: { driveId: 1, status: 'Approved' },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      expect(tx.participation.update).toHaveBeenNthCalledWith(1, {
        where: { id: 10 },
        data: { waste: 4 },
      });
      expect(tx.participation.update).toHaveBeenNthCalledWith(2, {
        where: { id: 11 },
        data: { waste: 4 },
      });
      expect(tx.participation.update).toHaveBeenNthCalledWith(3, {
        where: { id: 12 },
        data: { waste: 4 },
      });
      expect(result).toEqual(completedDrive);
    });

    it('distributes remainder waste deterministically', async () => {
      tx.drive.findUnique
        .mockResolvedValueOnce({
          id: 1,
          initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
          completed: false,
        })
        .mockResolvedValueOnce({ id: 1, completed: true, totalWasteKg: 5 });
      tx.drive.updateMany.mockResolvedValue({ count: 1 });
      tx.participation.findMany.mockResolvedValue([
        { id: 10 }, { id: 11 }, { id: 12 },
      ]);
      tx.participation.update.mockResolvedValue({});

      await service.completeDrive(1, 5);

      expect(tx.participation.update).toHaveBeenNthCalledWith(1, {
        where: { id: 10 },
        data: { waste: 2 },
      });
      expect(tx.participation.update).toHaveBeenNthCalledWith(2, {
        where: { id: 11 },
        data: { waste: 2 },
      });
      expect(tx.participation.update).toHaveBeenNthCalledWith(3, {
        where: { id: 12 },
        data: { waste: 1 },
      });
    });

    it('completes a non-Ploggers drive when no waste value is supplied', async () => {
      const completedDrive = { id: 2, completed: true, totalWasteKg: null };
      tx.drive.findUnique
        .mockResolvedValueOnce({
          id: 2,
          initiative: Initiative.SOCIAL_SHELF,
          completed: false,
        })
        .mockResolvedValueOnce(completedDrive);
      tx.drive.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.completeDrive(2)).resolves.toEqual(completedDrive);
      expect(tx.drive.updateMany).toHaveBeenCalledWith({
        where: { id: 2, completed: false },
        data: { completed: true },
      });
      expect(tx.participation.findMany).not.toHaveBeenCalled();
    });

    it('rejects waste tracking for non-Ploggers drives', async () => {
      tx.drive.findUnique.mockResolvedValue({
        id: 2,
        initiative: Initiative.SOCIAL_SHELF,
        completed: false,
      });

      await expect(service.completeDrive(2, 5)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.drive.updateMany).not.toHaveBeenCalled();
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid waste value %s before starting a transaction',
      async (waste) => {
        await expect(service.completeDrive(1, waste)).rejects.toThrow(
          BadRequestException,
        );
        expect(database.$transaction).not.toHaveBeenCalled();
      },
    );

    it('rejects a non-number waste value', async () => {
      await expect(
        service.completeDrive(1, '12' as unknown as number),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns 404 when the drive does not exist', async () => {
      tx.drive.findUnique.mockResolvedValue(null);
      await expect(service.completeDrive(999, 10)).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.drive.updateMany).not.toHaveBeenCalled();
    });

    it('rejects completing an already completed drive', async () => {
      tx.drive.findUnique.mockResolvedValue({
        id: 1,
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        completed: true,
      });

      await expect(service.completeDrive(1, 10)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.drive.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a concurrent completion when the conditional update affects no rows', async () => {
      tx.drive.findUnique.mockResolvedValue({
        id: 1,
        initiative: Initiative.SAMBHAJINAGAR_PLOGGERS,
        completed: false,
      });
      tx.drive.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeDrive(1)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.participation.findMany).not.toHaveBeenCalled();
    });

    it('rejects an invalid drive ID', async () => {
      await expect(service.completeDrive(0)).rejects.toThrow(
        BadRequestException,
      );
      expect(database.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('registerGuestVolunteer', () => {
    it('registers a guest volunteer and trims the name', async () => {
      database.drive.findUnique.mockResolvedValue({ id: 4 });
      const guest = { id: 1, driveId: 4, name: 'Rahul Sharma', hours: 0, waste: 0 };
      database.guestVolunteer.create.mockResolvedValue(guest);

      const result = await service.registerGuestVolunteer({
        driveId: 4,
        name: '  Rahul Sharma  ',
      });

      expect(database.guestVolunteer.create).toHaveBeenCalledWith({
        data: { driveId: 4, name: 'Rahul Sharma' },
      });
      expect(result.guestVolunteer).toEqual(guest);
    });

    it('rejects empty names, invalid IDs, and missing drives', async () => {
      await expect(service.registerGuestVolunteer({
        driveId: 4,
        name: '   ',
      })).rejects.toThrow(BadRequestException);

      await expect(service.registerGuestVolunteer({
        driveId: 0,
        name: 'Rahul',
      })).rejects.toThrow(BadRequestException);

      database.drive.findUnique.mockResolvedValue(null);
      await expect(service.registerGuestVolunteer({
        driveId: 999,
        name: 'Rahul',
      })).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGuestVolunteers', () => {
    it('returns guests for an existing drive', async () => {
      const guests = [{
        id: 1,
        driveId: 4,
        name: 'Rahul Sharma',
        hours: 0,
        waste: 0,
        createdAt: new Date('2026-10-23T08:00:00.000Z'),
      }];
      database.drive.findUnique.mockResolvedValue({ id: 4 });
      database.guestVolunteer.findMany.mockResolvedValue(guests);

      await expect(service.getGuestVolunteers(4)).resolves.toEqual(guests);
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
    });

    it('rejects invalid IDs and missing drives', async () => {
      await expect(service.getGuestVolunteers(0)).rejects.toThrow(
        BadRequestException,
      );
      database.drive.findUnique.mockResolvedValue(null);
      await expect(service.getGuestVolunteers(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateGuestVolunteer', () => {
    const ploggersGuest = {
      id: 2,
      drive: { initiative: Initiative.SAMBHAJINAGAR_PLOGGERS },
    };

    it('updates hours and waste for a Ploggers guest', async () => {
      database.guestVolunteer.findUnique.mockResolvedValue(ploggersGuest);
      database.guestVolunteer.update.mockResolvedValue({
        id: 2,
        hours: 3,
        waste: 2,
      });

      const result = await service.updateGuestVolunteer(2, {
        hours: 3,
        waste: 2,
      });

      expect(database.guestVolunteer.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { hours: 3, waste: 2 },
      });
      expect(result.guestVolunteer).toMatchObject({ hours: 3, waste: 2 });
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

    it('rejects empty, invalid, and negative updates', async () => {
      await expect(service.updateGuestVolunteer(2, {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateGuestVolunteer(0, { hours: 1 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateGuestVolunteer(2, { hours: -1 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateGuestVolunteer(2, { waste: 1.5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns 404 when the guest does not exist', async () => {
      database.guestVolunteer.findUnique.mockResolvedValue(null);
      await expect(
        service.updateGuestVolunteer(999, { hours: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 when the guest disappears before update', async () => {
      database.guestVolunteer.findUnique.mockResolvedValue(ploggersGuest);
      database.guestVolunteer.update.mockRejectedValue({
        code: 'P2025',
        message: 'Record not found',
      });

      await expect(
        service.updateGuestVolunteer(2, { hours: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
