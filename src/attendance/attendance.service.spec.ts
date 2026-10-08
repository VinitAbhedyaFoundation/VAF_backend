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

    service = new AttendanceService(
      db as unknown as DatabaseService,
    );
  });

  // ============================================================
  // GET MY ATTENDANCE
  // ============================================================

  describe('getMyAttendance', () => {
    it('should return attendance records for the requested user', async () => {
      const records = [
        {
          id: 1,
          driveId: 10,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
      ];

      db.participation.findMany.mockResolvedValue(records);

      const result =
        await service.getMyAttendance(5);

      expect(
        db.participation.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 5,
        },
        select: {
          id: true,
          driveId: true,
          status: true,
          attendanceMarked: true,
        },
      });

      expect(result).toEqual(records);
    });
  });

  // ============================================================
  // JOIN DRIVE
  // ============================================================

  describe('joinDrive', () => {
    it('should reject when the drive does not exist', async () => {
      db.drive.findUnique.mockResolvedValue(null);

      await expect(
        service.joinDrive(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Drive not found',
        ),
      );

      expect(
        db.participation.findUnique,
      ).not.toHaveBeenCalled();

      expect(
        db.participation.create,
      ).not.toHaveBeenCalled();
    });

    it('should reject joining a completed drive', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: true,
      });

      await expect(
        service.joinDrive(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Cannot join a completed drive',
        ),
      );

      expect(
        db.participation.create,
      ).not.toHaveBeenCalled();
    });

    it('should reject when the user already joined the drive', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
      });

      db.participation.findUnique.mockResolvedValue({
        id: 100,
      });

      await expect(
        service.joinDrive(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Already joined this drive',
        ),
      );

      expect(
        db.participation.create,
      ).not.toHaveBeenCalled();
    });

    it('should create a registered participation for a valid join', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
      });

      db.participation.findUnique.mockResolvedValue(
        null,
      );

      const createdParticipation = {
        id: 100,
        userId: 5,
        driveId: 10,
        status: AttendanceStatus.Registered,
        attendanceMarked: false,
      };

      db.participation.create.mockResolvedValue(
        createdParticipation,
      );

      const result =
        await service.joinDrive(5, 10);

      expect(
        db.participation.create,
      ).toHaveBeenCalledWith({
        data: {
          userId: 5,
          driveId: 10,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
      });

      expect(result).toEqual(
        createdParticipation,
      );
    });

    it('should convert a duplicate database constraint error into a bad request', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
      });

      db.participation.findUnique.mockResolvedValue(
        null,
      );

      const duplicateError =
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: 'test',
          },
        );

      db.participation.create.mockRejectedValue(
        duplicateError,
      );

      await expect(
        service.joinDrive(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Already joined this drive',
        ),
      );
    });
  });

  // ============================================================
  // MARK ATTENDANCE
  // ============================================================

  describe('markAttendance', () => {
    it('should reject when the drive does not exist', async () => {
      db.drive.findUnique.mockResolvedValue(null);

      await expect(
        service.markAttendance(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Drive not found',
        ),
      );
    });

    it('should reject attendance before the drive is completed', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: false,
      });

      await expect(
        service.markAttendance(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Attendance can only be marked after the drive is completed',
        ),
      );
    });

    it('should reject when the user did not join the drive', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: true,
      });

      db.participation.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.markAttendance(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Drive not joined',
        ),
      );
    });

    it('should reject attendance when the participation is not registered', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: true,
      });

      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Approved,
        attendanceMarked: true,
      });

      await expect(
        service.markAttendance(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Attendance cannot be marked in the current state',
        ),
      );
    });

    it('should mark registered attendance as pending', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: true,
      });

      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Registered,
        attendanceMarked: false,
      });

      db.participation.updateMany.mockResolvedValue({
        count: 1,
      });

      const result =
        await service.markAttendance(5, 10);

      expect(
        db.participation.updateMany,
      ).toHaveBeenCalledWith({
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

      expect(result).toEqual({
        message:
          'Attendance submitted successfully',
      });
    });

    it('should reject when the atomic attendance update affects no records', async () => {
      db.drive.findUnique.mockResolvedValue({
        completed: true,
      });

      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Registered,
        attendanceMarked: false,
      });

      db.participation.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.markAttendance(5, 10),
      ).rejects.toThrow(
        new BadRequestException(
          'Attendance already submitted',
        ),
      );
    });
  });

  // ============================================================
  // APPROVE ATTENDANCE
  // ============================================================

  describe('approveAttendance', () => {
    it('should approve a pending attendance record', async () => {
      db.participation.updateMany.mockResolvedValue({
        count: 1,
      });

      const result =
        await service.approveAttendance(
          100,
          3,
          5,
        );

      expect(
        db.participation.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 100,
          status: AttendanceStatus.Pending,
        },
        data: {
          status: AttendanceStatus.Approved,
          attendanceMarked: true,
          hours: 3,
          waste: 5,
        },
      });

      expect(result).toEqual({
        message:
          'Attendance approved successfully',
      });

      expect(
        db.participation.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('should reject when the attendance record does not exist', async () => {
      db.participation.updateMany.mockResolvedValue({
        count: 0,
      });

      db.participation.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.approveAttendance(
          100,
          3,
          5,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Attendance record not found',
        ),
      );
    });

    it('should reject an already approved attendance record', async () => {
      db.participation.updateMany.mockResolvedValue({
        count: 0,
      });

      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Approved,
      });

      await expect(
        service.approveAttendance(
          100,
          3,
          5,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Attendance already approved',
        ),
      );
    });

    it('should reject a non-pending attendance record', async () => {
      db.participation.updateMany.mockResolvedValue({
        count: 0,
      });

      db.participation.findUnique.mockResolvedValue({
        status: AttendanceStatus.Registered,
      });

      await expect(
        service.approveAttendance(
          100,
          3,
          5,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Attendance is not pending approval',
        ),
      );
    });
  });

  // ============================================================
  // BULK APPROVE
  // ============================================================

  describe('approveBulkAttendance', () => {
    it('should reject an empty list', async () => {
      await expect(
        service.approveBulkAttendance([]),
      ).rejects.toThrow(
        new BadRequestException(
          'No attendance records selected',
        ),
      );
    });

    it('should reject duplicate participation IDs', async () => {
      await expect(
        service.approveBulkAttendance([
          1,
          2,
          2,
        ]),
      ).rejects.toThrow(
        new BadRequestException(
          'Duplicate attendance records selected',
        ),
      );

      expect(
        db.participation.findMany,
      ).not.toHaveBeenCalled();
    });

    it('should reject when one or more records are missing', async () => {
      db.participation.findMany.mockResolvedValue([
        {
          id: 1,
          status: AttendanceStatus.Pending,
          drive: {
            totalHours: 2,
          },
        },
      ]);

      await expect(
        service.approveBulkAttendance([
          1,
          2,
        ]),
      ).rejects.toThrow(
        new BadRequestException(
          'One or more attendance records were not found',
        ),
      );
    });

    it('should reject records that cannot be approved', async () => {
      db.participation.findMany.mockResolvedValue([
        {
          id: 1,
          status: AttendanceStatus.Approved,
          drive: {
            totalHours: 2,
          },
        },
      ]);

      await expect(
        service.approveBulkAttendance([1]),
      ).rejects.toThrow(
        new BadRequestException(
          'One or more attendance records cannot be approved',
        ),
      );
    });

    it('should approve valid registered and pending records in a transaction', async () => {
      const participations = [
        {
          id: 1,
          status: AttendanceStatus.Registered,
          drive: {
            totalHours: 2,
          },
        },
        {
          id: 2,
          status: AttendanceStatus.Pending,
          drive: {
            totalHours: 3,
          },
        },
      ];

      db.participation.findMany.mockResolvedValue(
        participations,
      );

      const tx = {
        participation: {
          updateMany: jest
            .fn()
            .mockResolvedValue({
              count: 1,
            }),
        },
      };

      db.$transaction.mockImplementation(
        async (callback) =>
          callback(tx),
      );

      const result =
        await service.approveBulkAttendance([
          1,
          2,
        ]);

      expect(
        db.$transaction,
      ).toHaveBeenCalledTimes(1);

      expect(
        tx.participation.updateMany,
      ).toHaveBeenCalledTimes(2);

      expect(
        tx.participation.updateMany,
      ).toHaveBeenNthCalledWith(
        1,
        {
          where: {
            id: 1,
            status: {
              in: [
                AttendanceStatus.Registered,
                AttendanceStatus.Pending,
              ],
            },
          },
          data: {
            status: AttendanceStatus.Approved,
            attendanceMarked: true,
            hours: 2,
          },
        },
      );

      expect(result).toEqual({
        message:
          'Attendance approved successfully',
        approvedCount: 2,
      });
    });

    it('should fail the transaction when a record changes before approval', async () => {
      const participations = [
        {
          id: 1,
          status: AttendanceStatus.Pending,
          drive: {
            totalHours: 2,
          },
        },
      ];

      db.participation.findMany.mockResolvedValue(
        participations,
      );

      const tx = {
        participation: {
          updateMany: jest
            .fn()
            .mockResolvedValue({
              count: 0,
            }),
        },
      };

      db.$transaction.mockImplementation(
        async (callback) =>
          callback(tx),
      );

      await expect(
        service.approveBulkAttendance([1]),
      ).rejects.toThrow(
        new BadRequestException(
          'One or more attendance records changed before approval',
        ),
      );
    });
  });

  // ============================================================
  // SCAN ATTENDANCE
  // ============================================================

  describe('scanAttendance', () => {
    it('should reject an invalid QR participation ID', async () => {
      db.participation.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.scanAttendance(100),
      ).rejects.toThrow(
        new BadRequestException(
          'Invalid QR Code',
        ),
      );
    });

    it('should reject scanning a completed drive', async () => {
      db.participation.findUnique.mockResolvedValue({
        id: 100,
        attendanceMarked: false,
        status: AttendanceStatus.Registered,
        user: {
          id: 5,
          name: 'Test User',
          ploggerId: 'PLG001',
        },
        drive: {
          id: 10,
          title: 'Beach Cleanup',
          completed: true,
        },
      });

      await expect(
        service.scanAttendance(100),
      ).rejects.toThrow(
        new BadRequestException(
          'This drive has already been completed.',
        ),
      );
    });

    it('should reject already marked attendance', async () => {
      db.participation.findUnique.mockResolvedValue({
        id: 100,
        attendanceMarked: true,
        status: AttendanceStatus.Approved,
        user: {
          id: 5,
          name: 'Test User',
          ploggerId: 'PLG001',
        },
        drive: {
          id: 10,
          title: 'Beach Cleanup',
          completed: false,
        },
      });

      await expect(
        service.scanAttendance(100),
      ).rejects.toThrow(
        new BadRequestException(
          'Attendance already marked',
        ),
      );
    });

    it('should reject a volunteer who is not registered', async () => {
      db.participation.findUnique.mockResolvedValue({
        id: 100,
        attendanceMarked: false,
        status: AttendanceStatus.Pending,
        user: {
          id: 5,
          name: 'Test User',
          ploggerId: 'PLG001',
        },
        drive: {
          id: 10,
          title: 'Beach Cleanup',
          completed: false,
        },
      });

      await expect(
        service.scanAttendance(100),
      ).rejects.toThrow(
        new BadRequestException(
          'Volunteer is not eligible for attendance.',
        ),
      );
    });

    it('should mark registered attendance as approved', async () => {
      db.participation.findUnique.mockResolvedValue({
        id: 100,
        attendanceMarked: false,
        status: AttendanceStatus.Registered,
        user: {
          id: 5,
          name: 'Test User',
          ploggerId: 'PLG001',
        },
        drive: {
          id: 10,
          title: 'Beach Cleanup',
          completed: false,
        },
      });

      db.participation.updateMany.mockResolvedValue({
        count: 1,
      });

      const result =
        await service.scanAttendance(100);

      expect(
        db.participation.updateMany,
      ).toHaveBeenCalledWith({
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

      expect(result).toEqual({
        success: true,
        message:
          'Attendance marked successfully',
        volunteer: {
          id: 5,
          name: 'Test User',
          ploggerId: 'PLG001',
        },
        drive: {
          id: 10,
          title: 'Beach Cleanup',
        },
      });
    });

    it('should reject when the atomic scan update affects no records', async () => {
      db.participation.findUnique.mockResolvedValue({
        id: 100,
        attendanceMarked: false,
        status: AttendanceStatus.Registered,
        user: {
          id: 5,
          name: 'Test User',
          ploggerId: 'PLG001',
        },
        drive: {
          id: 10,
          title: 'Beach Cleanup',
          completed: false,
        },
      });

      db.participation.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.scanAttendance(100),
      ).rejects.toThrow(
        new BadRequestException(
          'Attendance is no longer available for this volunteer.',
        ),
      );
    });
  });
});