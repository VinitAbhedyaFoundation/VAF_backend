import { BadRequestException } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { DatabaseService } from '../database/database.service';

describe('AttendanceService', () => {
  let service: AttendanceService;

  const db = {
    participation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    drive: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceService(db as unknown as DatabaseService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getMyAttendance', () => {
    it('returns attendance records for the requested user', async () => {
      const records = [
        {
          id: 1,
          driveId: 10,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
      ];
      db.participation.findMany.mockResolvedValue(records);

      await expect(service.getMyAttendance(5)).resolves.toEqual(records);
      expect(db.participation.findMany).toHaveBeenCalledWith({
        where: { userId: 5 },
        select: {
          id: true,
          driveId: true,
          status: true,
          attendanceMarked: true,
        },
      });
    });
  });

  describe('joinDrive', () => {
    it('rejects when the drive does not exist', async () => {
      db.drive.findUnique.mockResolvedValue(null);

      await expect(service.joinDrive(5, 10)).rejects.toThrow(
        new BadRequestException('Drive not found'),
      );
      expect(db.participation.findUnique).not.toHaveBeenCalled();
      expect(db.participation.create).not.toHaveBeenCalled();
    });

    it('allows joining before the drive starts', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
        date: new Date(Date.now() + 60 * 60 * 1000),
        totalHours: 2,
      });
      db.participation.findUnique.mockResolvedValue(null);
      const created = {
        id: 101,
        userId: 5,
        driveId: 10,
        status: AttendanceStatus.Registered,
        attendanceMarked: false,
      };
      db.participation.create.mockResolvedValue(created);

      await expect(service.joinDrive(5, 10)).resolves.toEqual(created);
      expect(db.participation.create).toHaveBeenCalledWith({
        data: {
          userId: 5,
          driveId: 10,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
      });
    });

    it('allows joining during the drive', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
        date: new Date(Date.now() - 30 * 60 * 1000),
        totalHours: 2,
      });
      db.participation.findUnique.mockResolvedValue(null);
      db.participation.create.mockResolvedValue({ id: 102 });

      await expect(service.joinDrive(5, 10)).resolves.toEqual({ id: 102 });
    });

    it('allows joining within the two-hour grace period, even if the drive is marked completed', async () => {
      // The drive ended one hour ago; the grace period is still open.
      db.drive.findUnique.mockResolvedValue({
        completed: true,
        date: new Date(Date.now() - 3 * 60 * 60 * 1000),
        totalHours: 2,
      });
      db.participation.findUnique.mockResolvedValue(null);
      db.participation.create.mockResolvedValue({
        id: 103,
        userId: 5,
        driveId: 10,
        status: AttendanceStatus.Registered,
        attendanceMarked: false,
      });

      await expect(service.joinDrive(5, 10)).resolves.toMatchObject({
        userId: 5,
        driveId: 10,
        status: AttendanceStatus.Registered,
      });
      expect(db.participation.create).toHaveBeenCalledTimes(1);
    });

    it('rejects joining after the two-hour grace period', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
        date: new Date(Date.now() - 5 * 60 * 60 * 1000),
        totalHours: 2,
      });

      await expect(service.joinDrive(5, 10)).rejects.toThrow(
        new BadRequestException('The joining window for this drive has closed'),
      );
      expect(db.participation.findUnique).not.toHaveBeenCalled();
      expect(db.participation.create).not.toHaveBeenCalled();
    });

    it('rejects joining at the exact grace-period deadline', async () => {
      const fixedNow = new Date('2026-11-01T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fixedNow);

      db.drive.findUnique.mockResolvedValue({
        completed: true,
        // A two-hour drive that ended exactly two hours before fixedNow.
        date: new Date(fixedNow.getTime() - 4 * 60 * 60 * 1000),
        totalHours: 2,
      });

      await expect(service.joinDrive(5, 10)).rejects.toThrow(
        new BadRequestException('The joining window for this drive has closed'),
      );
      expect(db.participation.findUnique).not.toHaveBeenCalled();
      expect(db.participation.create).not.toHaveBeenCalled();
    });

    it('rejects when the user has already joined', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
        date: new Date(Date.now() + 60 * 60 * 1000),
        totalHours: 2,
      });
      db.participation.findUnique.mockResolvedValue({ id: 100 });

      await expect(service.joinDrive(5, 10)).rejects.toThrow(
        new BadRequestException('Already joined this drive'),
      );
      expect(db.participation.create).not.toHaveBeenCalled();
    });

    it('converts a duplicate database constraint error into a bad request', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
        date: new Date(Date.now() + 60 * 60 * 1000),
        totalHours: 2,
      });
      db.participation.findUnique.mockResolvedValue(null);
      db.participation.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.joinDrive(5, 10)).rejects.toThrow(
        new BadRequestException('Already joined this drive'),
      );
    });

    it('requests the date and planned hours needed for join-window validation', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
        date: new Date(Date.now() + 60 * 60 * 1000),
        totalHours: 2,
      });
      db.participation.findUnique.mockResolvedValue(null);
      db.participation.create.mockResolvedValue({ id: 104 });

      await service.joinDrive(5, 10);

      expect(db.drive.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { completed: true, date: true, totalHours: true },
      });
    });
  });

  describe('markAttendance', () => {
    it('rejects when the drive does not exist', async () => {
      db.drive.findUnique.mockResolvedValue(null);
      await expect(service.markAttendance(5, 10)).rejects.toThrow(
        new BadRequestException('Drive not found'),
      );
    });

    it('rejects attendance before the drive is completed', async () => {
      db.drive.findUnique.mockResolvedValue({ completed: false });
      await expect(service.markAttendance(5, 10)).rejects.toThrow(
        new BadRequestException(
          'Attendance can only be marked after the drive is completed',
        ),
      );
    });

    it('rejects when the user did not join the drive', async () => {
      db.drive.findUnique.mockResolvedValue({ completed: true });
      db.participation.findUnique.mockResolvedValue(null);
      await expect(service.markAttendance(5, 10)).rejects.toThrow(
        new BadRequestException('Drive not joined'),
      );
    });

    it('rejects attendance when participation is not registered', async () => {
      db.drive.findUnique.mockResolvedValue({ completed: true });
      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Approved,
        attendanceMarked: true,
      });
      await expect(service.markAttendance(5, 10)).rejects.toThrow(
        new BadRequestException('Attendance cannot be marked in the current state'),
      );
    });

    it('moves registered attendance to pending', async () => {
      db.drive.findUnique.mockResolvedValue({ completed: true });
      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Registered,
        attendanceMarked: false,
      });
      db.participation.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.markAttendance(5, 10)).resolves.toEqual({
        message: 'Attendance submitted successfully',
      });
      expect(db.participation.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 5,
          driveId: 10,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
        data: {
          attendanceMarked: true,
          status: AttendanceStatus.Pending,
        },
      });
    });

    it('rejects when the atomic attendance update affects no records', async () => {
      db.drive.findUnique.mockResolvedValue({ completed: true });
      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Registered,
        attendanceMarked: false,
      });
      db.participation.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.markAttendance(5, 10)).rejects.toThrow(
        new BadRequestException('Attendance already submitted'),
      );
    });
  });

  describe('approveAttendance', () => {
    it('approves a pending attendance record with the supplied hours and waste', async () => {
      db.participation.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.approveAttendance(100, 3, 5)).resolves.toEqual({
        message: 'Attendance approved successfully',
      });
      expect(db.participation.updateMany).toHaveBeenCalledWith({
        where: { id: 100, status: AttendanceStatus.Pending },
        data: {
          status: AttendanceStatus.Approved,
          attendanceMarked: true,
          hours: 3,
          waste: 5,
        },
      });
      expect(db.participation.findUnique).not.toHaveBeenCalled();
    });

    it('rejects when the attendance record does not exist', async () => {
      db.participation.updateMany.mockResolvedValue({ count: 0 });
      db.participation.findUnique.mockResolvedValue(null);
      await expect(service.approveAttendance(100, 3, 5)).rejects.toThrow(
        new BadRequestException('Attendance record not found'),
      );
    });

    it('rejects an already approved attendance record', async () => {
      db.participation.updateMany.mockResolvedValue({ count: 0 });
      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Approved,
      });
      await expect(service.approveAttendance(100, 3, 5)).rejects.toThrow(
        new BadRequestException('Attendance already approved'),
      );
    });

    it('rejects a non-pending attendance record', async () => {
      db.participation.updateMany.mockResolvedValue({ count: 0 });
      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Registered,
      });
      await expect(service.approveAttendance(100, 3, 5)).rejects.toThrow(
        new BadRequestException('Attendance is not pending approval'),
      );
    });
  });

  describe('approveBulkAttendance', () => {
    it('rejects an empty list', async () => {
      await expect(service.approveBulkAttendance([])).rejects.toThrow(
        new BadRequestException('No attendance records selected'),
      );
    });

    it('rejects duplicate participation IDs', async () => {
      await expect(service.approveBulkAttendance([1, 2, 2])).rejects.toThrow(
        new BadRequestException('Duplicate attendance records selected'),
      );
      expect(db.participation.findMany).not.toHaveBeenCalled();
    });

    it('rejects when one or more records are missing', async () => {
      db.participation.findMany.mockResolvedValue([
        { id: 1, status: AttendanceStatus.Pending, drive: { totalHours: 2 } },
      ]);
      await expect(service.approveBulkAttendance([1, 2])).rejects.toThrow(
        new BadRequestException('One or more attendance records were not found'),
      );
    });

    it('rejects records that cannot be approved', async () => {
      db.participation.findMany.mockResolvedValue([
        { id: 1, status: AttendanceStatus.Approved, drive: { totalHours: 2 } },
      ]);
      await expect(service.approveBulkAttendance([1])).rejects.toThrow(
        new BadRequestException('One or more attendance records cannot be approved'),
      );
    });

    it('approves valid registered and pending records in a transaction', async () => {
      const participations = [
        { id: 1, status: AttendanceStatus.Registered, drive: { totalHours: 2 } },
        { id: 2, status: AttendanceStatus.Pending, drive: { totalHours: 3 } },
      ];
      db.participation.findMany.mockResolvedValue(participations);
      const tx = {
        participation: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      db.$transaction.mockImplementation(async (callback) => callback(tx));

      await expect(service.approveBulkAttendance([1, 2])).resolves.toEqual({
        message: 'Attendance approved successfully',
        approvedCount: 2,
      });
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.participation.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: 1,
          status: { in: [AttendanceStatus.Registered, AttendanceStatus.Pending] },
        },
        data: {
          status: AttendanceStatus.Approved,
          attendanceMarked: true,
          hours: 2,
        },
      });
      expect(tx.participation.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: 2,
          status: { in: [AttendanceStatus.Registered, AttendanceStatus.Pending] },
        },
        data: {
          status: AttendanceStatus.Approved,
          attendanceMarked: true,
          hours: 3,
        },
      });
    });

    it('rolls back when a record changes before approval', async () => {
      db.participation.findMany.mockResolvedValue([
        { id: 1, status: AttendanceStatus.Pending, drive: { totalHours: 2 } },
      ]);
      const tx = {
        participation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      db.$transaction.mockImplementation(async (callback) => callback(tx));

      await expect(service.approveBulkAttendance([1])).rejects.toThrow(
        new BadRequestException(
          'One or more attendance records changed before approval',
        ),
      );
    });
  });

  describe('scanAttendance', () => {
    const validParticipation = {
      id: 100,
      attendanceMarked: false,
      status: AttendanceStatus.Registered,
      user: { id: 5, name: 'Test User', ploggerId: 'PLG001' },
      drive: { id: 10, title: 'Beach Cleanup', completed: false },
    };

    it('rejects an invalid QR participation ID', async () => {
      db.participation.findUnique.mockResolvedValue(null);
      await expect(service.scanAttendance(100)).rejects.toThrow(
        new BadRequestException('Invalid QR Code'),
      );
    });

    it('rejects scanning a completed drive', async () => {
      db.participation.findUnique.mockResolvedValue({
        ...validParticipation,
        drive: { ...validParticipation.drive, completed: true },
      });
      await expect(service.scanAttendance(100)).rejects.toThrow(
        new BadRequestException('This drive has already been completed.'),
      );
    });

    it('rejects already marked attendance', async () => {
      db.participation.findUnique.mockResolvedValue({
        ...validParticipation,
        attendanceMarked: true,
        status: AttendanceStatus.Approved,
      });
      await expect(service.scanAttendance(100)).rejects.toThrow(
        new BadRequestException('Attendance already marked'),
      );
    });

    it('rejects a volunteer who is not registered', async () => {
      db.participation.findUnique.mockResolvedValue({
        ...validParticipation,
        status: AttendanceStatus.Pending,
      });
      await expect(service.scanAttendance(100)).rejects.toThrow(
        new BadRequestException('Volunteer is not eligible for attendance.'),
      );
    });

    it('directly approves registered attendance when the QR code is scanned', async () => {
      db.participation.findUnique.mockResolvedValue(validParticipation);
      db.participation.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.scanAttendance(100)).resolves.toEqual({
        success: true,
        message: 'Attendance marked successfully',
        volunteer: { id: 5, name: 'Test User', ploggerId: 'PLG001' },
        drive: { id: 10, title: 'Beach Cleanup' },
      });
      expect(db.participation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 100,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
        data: {
          attendanceMarked: true,
          status: AttendanceStatus.Approved,
        },
      });
    });

    it('rejects when the atomic scan update affects no records', async () => {
      db.participation.findUnique.mockResolvedValue(validParticipation);
      db.participation.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.scanAttendance(100)).rejects.toThrow(
        new BadRequestException(
          'Attendance is no longer available for this volunteer.',
        ),
      );
    });
  });
});
