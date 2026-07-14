import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

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
    hours: number,
    waste: number,
  ) {
    const attendance =
      await this.db.participation.findUnique({
        where: {
          id,
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

    await this.db.participation.update({
      where: {
        id,
      },
      data: {
        status: 'Approved',
        attendanceMarked: true,
        hours,
        waste,
      },
    });

    return {
      message: 'Attendance approved successfully',
    };

  }
  async scanAttendance(participationId: number) {
    const participation =
      await this.db.participation.findUnique({
        where: {
          id: participationId,
        },
        include: {
          user: true,
          drive: true,
        },
      });

    if (!participation) {
      throw new BadRequestException(
        'Invalid QR Code',
      );
    }

    if (participation.drive.completed) {
      throw new BadRequestException(
        'This drive has already been completed.',
      );
    }

    if (participation.attendanceMarked) {
      throw new BadRequestException(
        'Attendance already marked',
      );
    }

    if (participation.status !== 'Registered') {
      throw new BadRequestException(
        'Volunteer is not eligible for attendance.',
      );
    }

    await this.db.participation.update({
      where: {
        id: participationId,
      },
      data: {
        attendanceMarked: true,
        status: 'Approved',
      },
    });

    return {
      success: true,
      message: 'Attendance marked successfully',
      volunteer: {
        id: participation.user.id,
        name: participation.user.name,
        ploggerId: participation.user.ploggerId,
      },
      drive: {
        id: participation.drive.id,
        title: participation.drive.title ?? 'Drive',
      },
    };
  }
}