import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UserService {
  constructor(private databaseService: DatabaseService) { }

  // 🔐 INTERNAL: Get user by DB id (JWT)
  async getUserById(userId: number) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          ploggerId: true,
        },
      });

      if (!user) throw new NotFoundException('User not found');

      return {
        message: 'User Details',
        user,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      console.error('getUserById error:', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  // 🔐 PUBLIC: Get user by ploggerId
  async getUserByPloggerId(ploggerId: string) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { ploggerId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          ploggerId: true,
        },
      });

      if (!user) throw new NotFoundException('User not found');

      return {
        message: 'User Details',
        user,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      console.error('getUserByPloggerId error:', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  // 🔐 ADMIN: Get all users
  async getAllUsers() {
    try {
      const users = await this.databaseService.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          ploggerId: true,
          role: true,
        },
        orderBy: { id: 'desc' },
      });

      return {
        message: 'Users fetched successfully',
        users,
      };
    } catch (error) {
      console.error('getAllUsers error:', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  // 🔐 ADMIN: Search users
  async searchUsers(query: string) {
    try {
      if (!query) {
        throw new BadRequestException('Search query is required');
      }

      const users = await this.databaseService.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { ploggerId: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          ploggerId: true,
          role: true,
        },
      });

      return {
        message: 'Search results',
        users,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      console.error('searchUsers error:', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  // 🔐 USER: Mark attendance
  async markAttendance(temporaryToken: string, userId: number) {
    try {
      if (!temporaryToken || temporaryToken.length < 10) {
        throw new BadRequestException('Invalid token');
      }

      const drive = await this.databaseService.drive.findFirst({
        where: { temporaryToken },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          expiryDate: true,
        },
      });

      if (!drive) {
        throw new NotFoundException('Drive not found or token is invalid.');
      }

      if (new Date(drive.expiryDate).getTime() < Date.now()) {
        throw new BadRequestException('Token has expired.');
      }

      // ✅ check via Participation
      const existing = await this.databaseService.participation.findUnique({
        where: {
          userId_driveId: {
            userId,
            driveId: drive.id,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('Attendance already marked');
      }

      await this.databaseService.$transaction([
        this.databaseService.participation.create({
          data: {
            userId,
            driveId: drive.id,
          },
        }),
        this.databaseService.drive.update({
          where: { id: drive.id },
          data: {
            volunteerCount: { increment: 1 },
          },
        }),
        this.databaseService.user.update({
          where: { id: userId },
          data: {
            drivesCount: { increment: 1 },
          },
        }),
      ]);

      return { message: 'Attendance marked successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('markAttendance error:', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  // 🔐 USER: Get drives attended
  async drivesAttended(userId: number) {
    try {
      const participations = await this.databaseService.participation.findMany({
        where: { userId },
        include: {
          drive: {
            include: {
              driveLocation: true,
            },
          },
        },
      });

const drives = participations.map((p: any) => ({
        id: p.drive.id,
        date: p.drive.date,
        totalHours: p.drive.totalHours,
        location: p.drive.driveLocation?.location || null,
      }));

      return {
        message: drives.length
          ? 'Drives Attended'
          : 'No drives attended',
        drives,
      };
    } catch (error) {
      console.error('drivesAttended error:', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }
}