import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UserService {
  constructor(private databaseService: DatabaseService) {}

  // =========================
  // 👤 USER DETAILS
  // =========================
  async userDetail(userId: number) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          parentNumber: true,
          bloodGroup: true,
          gender: true,
          occupation: true,
          highestQualification: true,
          address: true,
          city: true,
          state: true,
          collegeOrCompany: true,
          role: true,
          ploggerId: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User Details',
        user,
      };
    } catch (error) {
      console.error('error in user detail', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  // =========================
  // 📍 MARK ATTENDANCE
  // =========================
  async markAttendance(temporaryToken: string, userId: number) {
    try {
      const drive = await this.databaseService.drive.findFirst({
        where: { temporaryToken },
        orderBy: { date: 'desc' },
        include: {
          participations: true, // ✅ FIXED
        },
      });

      if (!drive) {
        throw new NotFoundException('Drive not found or token is invalid.');
      }

      const currDate = new Date();
      if (drive.expiryDate < currDate) {
        throw new BadRequestException('Token has expired.');
      }

      // ✅ check via participation
      const isAttendanceAlreadyMarked = drive.participations.some(
        (p: any) => p.userId === userId,
      );

      if (isAttendanceAlreadyMarked) {
        throw new BadRequestException('Attendance is already marked');
      }

      // ✅ create participation instead of users connect
      await this.databaseService.participation.create({
        data: {
          userId,
          driveId: drive.id,
        },
      });

      // ✅ update drive count
      await this.databaseService.drive.update({
        where: { id: drive.id },
        data: {
          volunteerCount: {
            increment: 1,
          },
        },
      });

      // ✅ update user stats
      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          drivesCount: {
            increment: 1,
          },
        },
      });

      return { message: 'Attendance marked successfully.' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      console.error('error in mark attendance', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  // =========================
  // 📋 DRIVES ATTENDED
  // =========================
  async drivesAttended(userId: number) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        include: {
          participations: {
            include: {
              drive: {
                include: {
                  driveLocation: true, // ✅ FIXED
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.participations.length === 0) {
        return {
          message: 'No drives attended',
          drives: [],
        };
      }

      const drives = user.participations.map((p: any) => ({
        id: p.drive.id,
        date: p.drive.date,
        totalHours: p.drive.totalHours,
        location: p.drive.driveLocation?.location,
      }));

      return {
        message: 'Drives Attended',
        drives,
      };
    } catch (error) {
      console.error('Error in drives attended:', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }
}