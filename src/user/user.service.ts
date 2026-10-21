import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { DatabaseService } from '../database/database.service';
import {
  AttendanceStatus,
  BloodGroup,
  Gender,
  Occupation,
  Prisma,
  Role,
  UserStatus,
} from '@prisma/client';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly databaseService: DatabaseService,
  ) { }
  private getErrorDetails(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }

  private handleDatabaseError(
    error: unknown,
    operation: string,
  ): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    this.logger.error(
      `${operation} failed`,
      this.getErrorDetails(error),
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Requested record not found');
      }

      if (error.code === 'P2002') {
        throw new ConflictException(
          'A record with this information already exists',
        );
      }
    }

    throw new InternalServerErrorException(
      `Failed to ${operation}`,
    );
  }

  private validateNonNegativeInteger(
    value: number,
    fieldName: string,
  ): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new BadRequestException(
        `${fieldName} must be a non-negative integer`,
      );
    }
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

      throw new InternalServerErrorException(
        'Failed to suspend user',
      );
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

      throw new InternalServerErrorException(
        'Failed to approve user',
      );
    }
  }

  async createUserId(gender: Gender): Promise<string> {
    const genderCode =
      gender === Gender.Male
        ? 1
        : gender === Gender.Female
          ? 2
          : 3;

    const year = new Date().getFullYear().toString().slice(-2);

    const lastUser = await this.databaseService.user.findFirst({
      select: { id: true },
      orderBy: { id: 'desc' },
    });

    const nextId = (lastUser?.id ?? 0) + 1;

    if (nextId > 99999) {
      throw new InternalServerErrorException(
        'Plogger ID sequence capacity exceeded',
      );
    }

    return `${year}${genderCode}${String(nextId).padStart(5, '0')}`;
  }

  // =========================
  // 👤 CREATE VOLUNTEER
  // =========================

  async createVolunteer(data: {
    name: string;
    email: string;
    city?: string;
    gender: Gender;
    password: string;
  }) {
    try {
      const name = data.name.trim();
      const email = data.email.trim().toLowerCase();
      const city = data.city?.trim() ?? '';

      if (!name || !email) {
        throw new BadRequestException(
          'Name and email are required',
        );
      }

      if (
        typeof data.password !== 'string' ||
        data.password.length < 8 ||
        data.password.length > 72
      ) {
        throw new BadRequestException(
          'Password must contain between 8 and 72 characters',
        );
      }

      if (!Object.values(Gender).includes(data.gender)) {
        throw new BadRequestException('Invalid gender');
      }

      const existingUser =
        await this.databaseService.user.findUnique({
          where: { email },
          select: { id: true },
        });

      if (existingUser) {
        throw new ConflictException('Email already registered');
      }

      const hashedPassword = await bcrypt.hash(data.password, 12);
      const ploggerId = await this.createUserId(data.gender);

      const volunteer = await this.databaseService.user.create({
        data: {
          name,
          email,
          city,
          password: hashedPassword,
          gender: data.gender,
          ploggerId,
          role: Role.User,
          status: UserStatus.Pending,
        },
        select: {
          id: true,
          name: true,
          email: true,
          city: true,
          gender: true,
          role: true,
          status: true,
          ploggerId: true,
        },
      });

      return {
        message: 'Volunteer created successfully',
        user: volunteer,
      };
    } catch (error: unknown) {
      this.handleDatabaseError(error, 'create volunteer');
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

            // Profile information
            phone: true,
            parentNumber: true,
            birthDate: true,
            gender: true,
            bloodGroup: true,
            occupation: true,
            highestQualification: true,
            address: true,
            city: true,
            state: true,
            collegeOrCompany: true,

            // Account information
            role: true,
            ploggerId: true,
            status: true,
            createdAt: true,
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

      throw new InternalServerErrorException(
        'Failed to fetch user',
      );
    }
  }

  // =========================
  // ✏️ UPDATE USER PROFILE
  // =========================

  async updateProfile(
    userId: number,
    data: {
      name?: string;
      birthDate?: string;
      gender?: Gender;
      bloodGroup?: BloodGroup;
      phone?: string;
      parentNumber?: string;
      address?: string;
      city?: string;
      state?: string;
      occupation?: Occupation;
      highestQualification?: string;
      collegeOrCompany?: string;
    },
  ) {
    try {
      const existingUser =
        await this.databaseService.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      if (data.birthDate !== undefined) {
        const date = new Date(data.birthDate);

        if (
          !data.birthDate ||
          Number.isNaN(date.getTime())
        ) {
          throw new BadRequestException(
            'Invalid birth date',
          );
        }
      }

      const updatedUser =
        await this.databaseService.user.update({
          where: { id: userId },
          data: {
            ...(data.name !== undefined && {
              name: data.name.trim(),
            }),
            ...(data.birthDate !== undefined && {
              birthDate: new Date(data.birthDate),
            }),
            ...(data.gender !== undefined && {
              gender: data.gender,
            }),
            ...(data.bloodGroup !== undefined && {
              bloodGroup: data.bloodGroup,
            }),
            ...(data.phone !== undefined && {
              phone: data.phone,
            }),
            ...(data.parentNumber !== undefined && {
              parentNumber: data.parentNumber,
            }),
            ...(data.address !== undefined && {
              address: data.address,
            }),
            ...(data.city !== undefined && {
              city: data.city,
            }),
            ...(data.state !== undefined && {
              state: data.state,
            }),
            ...(data.occupation !== undefined && {
              occupation: data.occupation,
            }),
            ...(data.highestQualification !== undefined && {
              highestQualification: data.highestQualification,
            }),
            ...(data.collegeOrCompany !== undefined && {
              collegeOrCompany: data.collegeOrCompany,
            }),
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            parentNumber: true,
            birthDate: true,
            gender: true,
            bloodGroup: true,
            occupation: true,
            highestQualification: true,
            address: true,
            city: true,
            state: true,
            collegeOrCompany: true,
            role: true,
            ploggerId: true,
            status: true,
            createdAt: true,
          },
        });

      return {
        message: 'Profile updated successfully',
        user: updatedUser,
      };
    } catch (error: unknown) {
      this.handleDatabaseError(error, 'update profile');
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
        throw new BadRequestException(
          'SuperAdmin cannot be deleted',
        );
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

      throw new InternalServerErrorException(
        'Failed to delete user',
      );
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

      throw new InternalServerErrorException(
        'Failed to fetch user',
      );
    }
  }

  // =========================
  // 👥 GET ALL USERS
  // =========================

  async getAllUsers() {
    try {
      const users = await this.databaseService.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          city: true,
          gender: true,
          birthDate: true,
          createdAt: true,
          ploggerId: true,
          role: true,
          status: true,
          participations: {
            select: {
              status: true,
              hours: true,
              waste: true,
            },
          },
        },
        orderBy: {
          id: 'desc',
        },
      });

      const formattedUsers = users.map((user) => {
        const approvedParticipations =
          user.participations.filter(
            (participation) =>
              participation.status === 'Approved',
          );

        const totalDrives =
          approvedParticipations.length;

        const totalHours =
          approvedParticipations.reduce(
            (sum, participation) =>
              sum + (participation.hours ?? 0),
            0,
          );

        const totalWaste =
          approvedParticipations.reduce(
            (sum, participation) =>
              sum + (participation.waste ?? 0),
            0,
          );

        const score =
          totalHours +
          totalWaste +
          totalDrives * 5;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          city: user.city,
          gender: user.gender,
          birthDate: user.birthDate,
          createdAt: user.createdAt,
          ploggerId: user.ploggerId,
          role: user.role,
          status: user.status,

          totalDrives,
          drivesCount: totalDrives,

          totalHours,

          totalWaste,
          wasteKg: totalWaste,

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

      throw new InternalServerErrorException(
        'Failed to fetch users',
      );
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
          const approvedParticipations =
            user.participations.filter(
              (participation) =>
                participation.status === 'Approved',
            );

          const totalDrives =
            approvedParticipations.length;

          const totalHours =
            approvedParticipations.reduce(
              (sum, participation) =>
                sum + (participation.hours ?? 0),
              0,
            );

          const totalWaste =
            approvedParticipations.reduce(
              (sum, participation) =>
                sum + (participation.waste ?? 0),
              0,
            );

          const score =
            totalHours +
            totalWaste +
            totalDrives * 5;

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

      throw new InternalServerErrorException(
        'Failed to fetch leaderboard',
      );
    }
  }

  // =========================
  // 🔍 SEARCH USERS
  // =========================

  async searchUsers(query: string) {
    try {
      if (!query) {
        throw new BadRequestException(
          'Search query is required',
        );
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

      throw new InternalServerErrorException(
        'Failed to search users',
      );
    }
  }

  // =========================
  // 📍 MARK ATTENDANCE
  // =========================

  async markAttendance(
    temporaryToken: string,
    userId: number,
  ) {
    try {
      if (
        typeof temporaryToken !== 'string' ||
        !temporaryToken.trim()
      ) {
        throw new BadRequestException('Invalid token');
      }

      const drive = await this.databaseService.drive.findUnique({
        where: {
          temporaryToken: temporaryToken.trim(),
        },
        select: {
          id: true,
          expiryDate: true,
          completed: true,
        },
      });

      if (!drive) {
        throw new NotFoundException(
          'Drive not found or token is invalid.',
        );
      }

      if (drive.completed) {
        throw new BadRequestException(
          'Attendance cannot be marked for a completed drive',
        );
      }

      if (
        drive.expiryDate &&
        drive.expiryDate.getTime() <= Date.now()
      ) {
        throw new BadRequestException(
          'Attendance token has expired',
        );
      }

      await this.databaseService.participation.create({
        data: {
          userId,
          driveId: drive.id,
          status: AttendanceStatus.Pending,
          attendanceMarked: true,
        },
      });

      return {
        message: 'Attendance submitted for approval',
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Attendance has already been submitted for this drive',
        );
      }

      this.handleDatabaseError(error, 'mark attendance');
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

      const drives = participations.map(
        (participation) => ({
          id: participation.drive.id,
          date: participation.drive.date,
          totalHours: participation.drive.totalHours,
          hours: participation.hours ?? 0,
          waste: participation.waste ?? 0,
          status: participation.status,
          location:
            participation.drive.driveLocation?.location ??
            null,
        }),
      );

      return {
        message: drives.length
          ? 'Drives Attended'
          : 'No drives attended',
        drives,
      };
    } catch (error: unknown) {
      this.logger.error(
        'drivesAttended error:',
        this.getErrorDetails(error),
      );

      throw new InternalServerErrorException(
        'Failed to fetch attended drives',
      );
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
        throw new BadRequestException(
          'Cannot modify SuperAdmin',
        );
      }

      if (user.role === Role.Admin) {
        throw new BadRequestException(
          'User is already Admin',
        );
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

      throw new InternalServerErrorException(
        'Failed to promote user',
      );
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
        message:
          'Pending attendance fetched successfully',
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

  async approveAttendance(
    id: number,
    hours?: number,
    waste?: number,
  ) {
    try {
      const attendance =
        await this.databaseService.participation.findUnique({
          where: { id },
          include: {
            drive: {
              select: {
                totalHours: true,
              },
            },
          },
        });

      if (!attendance) {
        throw new NotFoundException(
          'Attendance record not found',
        );
      }

      if (attendance.status !== AttendanceStatus.Pending) {
        throw new BadRequestException(
          'Only pending attendance can be approved',
        );
      }

      const attendanceHours =
        hours === undefined
          ? attendance.drive.totalHours
          : hours;

      const attendanceWaste =
        waste === undefined
          ? attendance.waste
          : waste;

      this.validateNonNegativeInteger(
        attendanceHours,
        'Hours',
      );

      this.validateNonNegativeInteger(
        attendanceWaste,
        'Waste',
      );

      if (attendanceHours > attendance.drive.totalHours) {
        throw new BadRequestException(
          'Approved hours cannot exceed the drive total hours',
        );
      }

      const updatedAttendance =
        await this.databaseService.$transaction(
          async (tx) => {
            // Atomically claim the pending attendance record.
            // Only one concurrent request can update this record.
            const result =
              await tx.participation.updateMany({
                where: {
                  id,
                  status: AttendanceStatus.Pending,
                },
                data: {
                  status: AttendanceStatus.Approved,
                  attendanceMarked: true,
                  hours: attendanceHours,
                  waste: attendanceWaste,
                },
              });

            if (result.count !== 1) {
              throw new ConflictException(
                'Attendance has already been processed',
              );
            }

            // Increment counters only after successfully
            // transitioning attendance from Pending to Approved.
            await tx.user.update({
              where: {
                id: attendance.userId,
              },
              data: {
                drivesCount: {
                  increment: 1,
                },
              },
            });

            await tx.drive.update({
              where: {
                id: attendance.driveId,
              },
              data: {
                volunteerCount: {
                  increment: 1,
                },
              },
            });

            const record =
              await tx.participation.findUnique({
                where: { id },
              });

            if (!record) {
              throw new NotFoundException(
                'Attendance record not found after approval',
              );
            }

            return record;
          },
        );

      return {
        message: 'Attendance approved successfully',
        attendance: updatedAttendance,
      };
    } catch (error: unknown) {
      this.handleDatabaseError(
        error,
        'approve attendance',
      );
    }
  }

  // =========================
  // ❌ REJECT ATTENDANCE
  // =========================

  async rejectAttendance(id: number) {
    try {
      const result =
        await this.databaseService.participation.updateMany({
          where: {
            id,
            status: AttendanceStatus.Pending,
          },
          data: {
            status: AttendanceStatus.Rejected,
          },
        });

      if (result.count !== 1) {
        const attendance =
          await this.databaseService.participation.findUnique({
            where: { id },
            select: { id: true },
          });

        if (!attendance) {
          throw new NotFoundException(
            'Attendance record not found',
          );
        }

        throw new ConflictException(
          'Only pending attendance can be rejected',
        );
      }

      const updatedAttendance =
        await this.databaseService.participation.findUnique({
          where: { id },
        });

      return {
        message: 'Attendance rejected successfully',
        attendance: updatedAttendance,
      };
    } catch (error: unknown) {
      this.handleDatabaseError(error, 'reject attendance');
    }
  }
}