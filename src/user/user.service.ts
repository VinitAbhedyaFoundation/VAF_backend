import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { Role, UserStatus } from '@prisma/client';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  private getErrorDetails(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

  // =========================
  // 🚫 SUSPEND USER
  // =========================

  async suspendUser(id: number) {
    try {
      const user =
        await this.databaseService.user.findUnique({
          where: { id },
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role === Role.SuperAdmin) {
        throw new BadRequestException('Cannot modify SuperAdmin');
      }

      const updatedUser =
        await this.databaseService.user.update({
          where: { id },
          data: {
            status: UserStatus.Suspended,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            ploggerId: true,
          },
        });

      return {
        message: 'User suspended successfully',
        user: updatedUser,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'suspendUser error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to suspend user');
    }
  }

  // =========================
  // ✅ APPROVE USER
  // =========================

  async approveUser(id: number) {
    try {
      const user =
        await this.databaseService.user.findUnique({
          where: { id },
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role === Role.SuperAdmin) {
        throw new BadRequestException('Cannot modify SuperAdmin');
      }

      const updatedUser =
        await this.databaseService.user.update({
          where: { id },
          data: {
            status: UserStatus.Approved,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            ploggerId: true,
          },
        });

      return {
        message: 'User approved successfully',
        user: updatedUser,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'approveUser error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to approve user');
    }
  }

  // =========================
  // 👤 USER DETAILS
  // =========================

  async getUserById(userId: number) {
    try {
      const user =
        await this.databaseService.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            ploggerId: true,
            status: true,
          },
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User Details',
        user,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        'getUserById error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  // =========================
  // 👤 DELETE USER
  // =========================

  async deleteUser(id: number) {
    try {
      const user =
        await this.databaseService.user.findUnique({
          where: { id },
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role === Role.SuperAdmin) {
        throw new BadRequestException('SuperAdmin cannot be deleted');
      }

      await this.databaseService.user.delete({
        where: { id },
      });

      return {
        message: 'User deleted successfully',
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'deleteUser error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to delete user');
    }
  }

  // =========================
  // 👤 GET USER BY PLOGGER ID
  // =========================

  async getUserByPloggerId(ploggerId: string) {
    try {
      const user =
        await this.databaseService.user.findUnique({
          where: {
            ploggerId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            ploggerId: true,
            status: true,
          },
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User Details',
        user,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        'getUserByPloggerId error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  // =========================
  // 👥 GET ALL USERS
  // =========================

  async getAllUsers() {
    try {
      const users =
        await this.databaseService.user.findMany({
          include: {
            participations: true,
          },
          orderBy: {
            id: 'desc',
          },
        });

      const formattedUsers = users.map((user) => {
        const approvedParticipations = user.participations.filter(
  (participation) => participation.status === 'Approved',
);

const totalDrives = approvedParticipations.length;

const totalHours = approvedParticipations.reduce(
  (sum, participation) => sum + (participation.hours ?? 0),
  0,
);

const totalWaste = approvedParticipations.reduce(
  (sum, participation) => sum + (participation.waste ?? 0),
  0,
);
        const score = totalHours + totalWaste + totalDrives * 5;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          ploggerId: user.ploggerId,
          role: user.role,
          status: user.status,
          totalDrives,
          totalHours,
          totalWaste,
          score,
        };
      });

      return {
        message: 'Users fetched successfully',
        users: formattedUsers,
      };
    } catch (error: unknown) {
      this.logger.error(
        'getAllUsers error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  // =========================
  // 🏆 GET LEADERBOARD
  // =========================

  async getLeaderboard() {
    try {
      const users =
        await this.databaseService.user.findMany({
          where: {
            role: Role.User,
            status: UserStatus.Approved,
          },
          include: {
            participations: true,
          },
        });

      const ranked = users
        .map((user) => {
          const approvedParticipations = user.participations.filter(
            (participation) => participation.status === 'Approved'
          );

          const totalDrives = approvedParticipations.length;
          const totalHours = approvedParticipations.reduce(
            (sum, participation) => sum + (participation.hours ?? 0),
            0,
          );
          const totalWaste = approvedParticipations.reduce(
  (sum, participation) => sum + (participation.waste ?? 0),
  0,
);
          const score = totalHours + totalWaste + totalDrives * 5;

          return {
            id: user.id,
            name: user.name,
            ploggerId: user.ploggerId,
            totalDrives,
            totalHours,
            totalWaste,
            score,
          };
        })
        .sort((a, b) => b.score - a.score)
        .map((user, index) => ({
          rank: index + 1,
          ...user,
        }));

      return {
        message: 'Leaderboard fetched successfully',
        leaderboard: ranked,
      };
    } catch (error: unknown) {
      this.logger.error(
        'getLeaderboard error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to fetch leaderboard');
    }
  }

  // =========================
  // 🔍 SEARCH USERS
  // =========================

  async searchUsers(query: string) {
    try {
      if (!query) {
        throw new BadRequestException('Search query is required');
      }

      const users =
        await this.databaseService.user.findMany({
          where: {
            OR: [
              {
                name: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                ploggerId: {
                  contains: query,
                },
              },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            ploggerId: true,
            role: true,
            status: true,
            createdAt: true,
          },
        });

      return {
        message: 'Search results',
        users,
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        'searchUsers error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to search users');
    }
  }

  // =========================
  // 📍 MARK ATTENDANCE
  // =========================

  async markAttendance(temporaryToken: string, userId: number) {
    try {
      if (!temporaryToken) {
        throw new BadRequestException('Invalid token');
      }

      const drive =
        await this.databaseService.drive.findFirst({
          where: {
            temporaryToken,
          },
          orderBy: {
            date: 'desc',
          },
          select: {
            id: true,
          },
        });

      if (!drive) {
        throw new NotFoundException('Drive not found or token is invalid.');
      }

      const existing =
        await this.databaseService.participation.findUnique({
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
          where: {
            id: drive.id,
          },
          data: {
            volunteerCount: {
              increment: 1,
            },
          },
        }),

        this.databaseService.user.update({
          where: {
            id: userId,
          },
          data: {
            drivesCount: {
              increment: 1,
            },
          },
        }),
      ]);

      return {
        message: 'Attendance marked successfully',
      };
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        'markAttendance error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to mark attendance');
    }
  }

  // =========================
  // 📋 DRIVES ATTENDED
  // =========================

  async drivesAttended(userId: number) {
    try {
      const participations =
        await this.databaseService.participation.findMany({
          where: {
            userId,
          },
          include: {
            drive: {
              include: {
                driveLocation: true,
              },
            },
          },
        });

      const drives = participations.map((participation) => ({
        id: participation.drive.id,
        date: participation.drive.date,
        totalHours: participation.drive.totalHours,
        hours: participation.hours ?? 0,
        waste: participation.waste ?? 0,
        status: participation.status,
        location: participation.drive.driveLocation?.location ?? null,
      }));

      return {
        message: drives.length ? 'Drives Attended' : 'No drives attended',
        drives,
      };
    } catch (error: unknown) {
      this.logger.error(
        'drivesAttended error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to fetch attended drives');
    }
  }

  // =========================
  // 👑 PROMOTE USER
  // =========================

  async promoteUser(id: number) {
    try {
      const user =
        await this.databaseService.user.findUnique({
          where: { id },
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role === Role.SuperAdmin) {
        throw new BadRequestException('Cannot modify SuperAdmin');
      }

      if (user.role === Role.Admin) {
        throw new BadRequestException('User is already Admin');
      }

      const updatedUser =
        await this.databaseService.user.update({
          where: { id },
          data: {
            role: Role.Admin,
            status: UserStatus.Approved,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            ploggerId: true,
          },
        });

      return {
        message: 'User promoted to Admin successfully',
        user: updatedUser,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'promoteUser error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to promote user');
    }
  }

  // =========================
  // 📋 GET PENDING ATTENDANCE
  // =========================

  async getPendingAttendance() {
    try {
      const pendingAttendance =
        await this.databaseService.participation.findMany({
          where: {
            status: 'Pending',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            drive: {
              select: {
                id: true,
                date: true,
                totalHours: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      return {
        message: 'Pending attendance fetched successfully',
        attendance: pendingAttendance,
      };
    } catch (error: unknown) {
this.logger.error(
  'getPendingAttendance error:',
  this.getErrorDetails(error),
);
      throw new InternalServerErrorException(
  'Failed to fetch pending attendance',
);
    }
  }

  // =========================
  // ✅ APPROVE ATTENDANCE
  // =========================

  async approveAttendance(id: number, hours?: number, waste?: number) {
    try {
      const attendance =
        await this.databaseService.participation.findUnique({
          where: { id },
        });

      if (!attendance) {
        throw new NotFoundException('Attendance record not found');
      }

      const updatedAttendance =
        await this.databaseService.participation.update({
          where: { id },
          data: {
            status: 'Approved',
            ...(hours !== undefined && { hours }),
            ...(waste !== undefined && { waste }),
          },
        });

      return {
        message: 'Attendance approved successfully',
        attendance: updatedAttendance,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        'approveAttendance error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to approve attendance');
    }
  }

  // =========================
  // ❌ REJECT ATTENDANCE
  // =========================

  async rejectAttendance(id: number) {
    try {
      const attendance =
        await this.databaseService.participation.findUnique({
          where: { id },
        });

      if (!attendance) {
        throw new NotFoundException('Attendance record not found');
      }

      const updatedAttendance =
        await this.databaseService.participation.update({
          where: { id },
          data: {
            status: 'Rejected',
          },
        });

      return {
        message: 'Attendance rejected successfully',
        attendance: updatedAttendance,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        'rejectAttendance error:',
        this.getErrorDetails(error),
      );
      throw new InternalServerErrorException('Failed to reject attendance');
    }
  }
}
