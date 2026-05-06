import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AttendanceService {
  constructor(private db: DatabaseService) {}

  // 🔹 GET ALL ATTENDANCE
  async getAll() {
    return this.db.participation.findMany({
      include: {
        user: true,
        drive: true,
      },
    });
  }

  // 🔹 MARK ATTENDANCE
  async markAttendance(userId: number, driveId: number) {
    try {
      return await this.db.participation.create({
        data: {
          userId,
          driveId,
        },
      });
    } catch (error) {
      throw new BadRequestException('Attendance already marked');
    }
  }

  // 🔹 APPROVE ATTENDANCE (TEMPORARY FIX)
  async approveAttendance(id: number) {
    throw new BadRequestException(
      'Approval system not implemented yet (no status field)',
    );
  }
}