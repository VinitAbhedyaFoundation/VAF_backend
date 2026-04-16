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

  async markAttendance(temporaryToken: string, userId: number) {
    try {
      const drive = await this.databaseService.drive.findFirst({
        where: { temporaryToken },
        orderBy: { date: 'desc' },
        include: { users: true },
      });

      if (!drive) {
        throw new NotFoundException('Drive not found or token is invalid.');
      }

      const currDate = new Date();
      if (drive.expiryDate < currDate) {
        throw new BadRequestException('Token has expired.');
      }

      const isAttendanceAlreadyMarked = drive.users.some(
        (user) => user.id === userId,
      );

      if (isAttendanceAlreadyMarked) {
        throw new BadRequestException('Attendance is already marked');
      }

      await this.databaseService.drive.update({
        where: { id: drive.id },
        data: {
          users: {
            connect: { id: userId },
          },
          volunteerCount: {
            increment: 1,
          },
        },
      });

      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          drivesCount: {
            increment: 1, // ✅ FIXED
          },
        },
      });

      return { message: 'Attendance marked successfully.' };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('error in mark attendance', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async drivesAttended(userId: number) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        include: {
          drives: {
            include: {
              driveLocation: true, // ✅ FIXED (no extra queries)
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.drives.length === 0) {
        return {
          message: 'No drives attended',
          drives: [],
        };
      }

      const drives = user.drives.map((drive) => ({
        id: drive.id,
        date: drive.date,
        totalHours: drive.totalHours,
        location: drive.driveLocation?.location,
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