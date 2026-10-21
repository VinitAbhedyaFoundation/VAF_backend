import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

describe('AttendanceController', () => {
  let controller: AttendanceController;

  const attendanceService = {
    getAll: jest.fn(),
    joinDrive: jest.fn(),
    markAttendance: jest.fn(),
    scanAttendance: jest.fn(),
    approveAttendance: jest.fn(),
    approveBulkAttendance: jest.fn(),
    getMyAttendance: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        {
          provide: AttendanceService,
          useValue: attendanceService,
        },
      ],
    }).compile();

    controller = module.get<AttendanceController>(AttendanceController);
  });

  describe('getAll', () => {
    it('should return all attendance records', async () => {
      const records = [{ id: 1 }, { id: 2 }];

      attendanceService.getAll.mockResolvedValue(records);

      await expect(controller.getAll()).resolves.toEqual(records);

      expect(attendanceService.getAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('joinDrive', () => {
    it('should pass the authenticated user ID and drive ID to the service', async () => {
      const req = {
        user: {
          sub: 10,
        },
      };

      const body = {
        driveId: 25,
      };

      const result = {
        id: 1,
        userId: 10,
        driveId: 25,
      };

      attendanceService.joinDrive.mockResolvedValue(result);

      await expect(controller.joinDrive(req, body)).resolves.toEqual(result);

      expect(attendanceService.joinDrive).toHaveBeenCalledWith(10, 25);
    });
  });

  describe('markAttendance', () => {
    it('should pass the authenticated user ID and drive ID to the service', async () => {
      const req = {
        user: {
          sub: 10,
        },
      };

      const body = {
        driveId: 25,
      };

      const result = {
        message: 'Attendance submitted successfully',
      };

      attendanceService.markAttendance.mockResolvedValue(result);

      await expect(controller.markAttendance(req, body)).resolves.toEqual(
        result,
      );

      expect(attendanceService.markAttendance).toHaveBeenCalledWith(10, 25);
    });
  });

  describe('scanAttendance', () => {
    it('should pass the participation ID to the service', async () => {
      const dto = {
        participationId: 50,
      };

      const result = {
        success: true,
        message: 'Attendance marked successfully',
      };

      attendanceService.scanAttendance.mockResolvedValue(result);

      await expect(controller.scanAttendance(dto)).resolves.toEqual(result);

      expect(attendanceService.scanAttendance).toHaveBeenCalledWith(50);
    });
  });

  describe('approve', () => {
    it('should pass the ID, hours, and waste to the service', async () => {
      const id = 50;

      const body = {
        hours: 4,
        waste: 12,
      };

      const result = {
        message: 'Attendance approved successfully',
      };

      attendanceService.approveAttendance.mockResolvedValue(result);

      await expect(controller.approve(id, body)).resolves.toEqual(result);

      expect(attendanceService.approveAttendance).toHaveBeenCalledWith(
        50,
        4,
        12,
      );
    });
  });

  describe('approveBulk', () => {
    it('should pass participation IDs to the service', async () => {
      const body = {
        participationIds: [1, 2, 3],
      };

      const result = {
        message: 'Attendance approved successfully',
        approvedCount: 3,
      };

      attendanceService.approveBulkAttendance.mockResolvedValue(result);

      await expect(controller.approveBulk(body)).resolves.toEqual(result);

      expect(
        attendanceService.approveBulkAttendance,
      ).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe('getMyAttendance', () => {
    it('should pass the authenticated user ID to the service', async () => {
      const req = {
        user: {
          sub: 10,
        },
      };

      const records = [
        {
          id: 1,
          driveId: 25,
          status: 'Approved',
          attendanceMarked: true,
        },
      ];

      attendanceService.getMyAttendance.mockResolvedValue(records);

      await expect(controller.getMyAttendance(req)).resolves.toEqual(records);

      expect(attendanceService.getMyAttendance).toHaveBeenCalledWith(10);
    });
  });
});