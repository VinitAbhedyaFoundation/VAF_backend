import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { Participation, Prisma } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(
    private db: DatabaseService,
  ) { }

  // 🔹 GET ALL ATTENDANCE
  async getAll() {
    return this.db.participation.findMany({
      include: {
        user: true,
        drive: true,
      },
    });
  }

  // 🔹 GET MY ATTENDANCE
  async getMyAttendance(
    userId: number,
  ) {
    return this.db.participation.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        driveId: true,
        status: true,
        attendanceMarked: true,
      },
    });
  }

  // JOIN A DRIVE
  async joinDrive(userId: number, driveId: number) {
    const drive = await this.db.drive.findUnique({
      where: {
        id: driveId,
      },
      select: {
        completed: true,
      },
    });

    if (!drive) {
      throw new BadRequestException(
        'Drive not found',
      );
    }
    if (drive.completed) {
      throw new BadRequestException(
        'Cannot join a completed drive',
      );
    }

    const existingParticipation =
      await this.db.participation.findUnique({
        where: {
          userId_driveId: {
            userId,
            driveId,
          },
        },
      });

    if (existingParticipation) {
      throw new BadRequestException(
        'Already joined this drive',
      );
    }
    try {
      return await this.db.participation.create({
        data: {
          userId,
          driveId,
          status: 'Registered',
          attendanceMarked: false,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Already joined this drive',
        );
      }

      throw error;
    }
  }

  // 🔹 MARK ATTENDANCE
  async markAttendance(
    userId: number,
    driveId: number,
  ) {

    const drive = await this.db.drive.findUnique({
      where: {
        id: driveId,
      },
      select: {
        completed: true,
      },
    });

    if (!drive) {
      throw new BadRequestException(
        'Drive not found',
      );
    }
    if (!drive.completed) {
      throw new BadRequestException(
        'Attendance can only be marked after the drive is completed',
      );
    }

    const participation =
      await this.db.participation.findUnique({
        where: {
          userId_driveId: {
            userId,
            driveId,
          },
        },
      });

    if (!participation) {
      throw new BadRequestException(
        'Drive not joined',
      );
    }

    if (participation.status !== 'Registered') {
      throw new BadRequestException(
        'Attendance cannot be marked in the current state',
      );
    }

    const result =
      await this.db.participation.updateMany({
        where: {
          userId,
          driveId,
          attendanceMarked: false,
        },
        data: {
          attendanceMarked: true,
          status: 'Pending',
        },
      });

    if (result.count === 0) {
      throw new BadRequestException(
        'Attendance already submitted',
      );
    }

    return {
      message: 'Attendance submitted successfully',
    };
  }

  // 🔹 APPROVE ATTENDANCE
  // 🔹 APPROVE ATTENDANCE
  async approveAttendance(
    id: number,
  ) {
    const attendance =
      await this.db.participation.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          status: true,
        },
      });

    if (!attendance) {
      throw new BadRequestException(
        'Attendance record not found',
      );
    }

    if (attendance.status === 'Approved') {
      throw new BadRequestException(
        'Attendance already approved',
      );
    }

    if (attendance.status !== 'Pending') {
      throw new BadRequestException(
        'Attendance is not pending approval',
      );
    }

    const result =
      await this.db.participation.updateMany({
        where: {
          id,
          status: 'Pending',
        },
        data: {
          status: 'Approved',
        },
      });

    if (result.count === 0) {
      throw new BadRequestException(
        'Attendance approval failed',
      );
    }

    return {
      message: 'Attendance approved successfully',
    };
  }
}