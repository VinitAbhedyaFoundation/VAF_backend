import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';

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
    try {
      return await this.db.participation.create({
        data: {
          userId,
          driveId,
          status: 'Registered',
          attendanceMarked: false,
        },
      });
    } catch {
      throw new BadRequestException(
        'Already joined this drive',
      );
    }
  }

  // 🔹 MARK ATTENDANCE
  async markAttendance(
    userId: number,
    driveId: number,
  ) {
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

    if (participation.attendanceMarked) {
      throw new BadRequestException(
        'Attendance already submitted',
      );
    }

    return this.db.participation.update({
      where: {
        userId_driveId: {
          userId,
          driveId,
        },
      },
      data: {
        attendanceMarked: true,
        status: 'Pending',
      },
    });
  }

  // 🔹 APPROVE ATTENDANCE
  async approveAttendance(
    id: number,
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

    return this.db.participation.update({
      where: {
        id,
      },
      data: {
        status: 'Approved',
      },
    });
  }
}