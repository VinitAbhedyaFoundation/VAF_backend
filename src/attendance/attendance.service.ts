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
      },
    });
  }

  // 🔹 MARK ATTENDANCE
  async markAttendance(
  userId: number,
  driveId: number,
) {
  try {
    return await this.db.participation.create({
      data: {
        userId,
        driveId,
      },
    });
  } catch (error) {
    console.log('========== ERROR ==========');
    console.log(error);
    console.log('USER ID:', userId);
    console.log('DRIVE ID:', driveId);

    throw error;
  }
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