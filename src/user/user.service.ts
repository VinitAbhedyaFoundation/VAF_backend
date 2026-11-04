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

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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

  private validatePagination(page: number, limit: number): void {
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }
  }

  private isPloggerIdUniqueConflict(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.some((field) =>
        String(field).toLowerCase().includes('ploggerid'),
      );
    }

    return (
      typeof target === 'string' &&
      target.toLowerCase().includes('ploggerid')
    );
  }

  async suspendUser(id: number) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role === Role.SuperAdmin) {
        throw new BadRequestException('Cannot modify SuperAdmin');
      }

      const updatedUser = await this.databaseService.user.update({
        where: { id },
        data: { status: UserStatus.Suspended },
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

  async approveUser(id: number) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role === Role.SuperAdmin) {
        throw new BadRequestException('Cannot modify SuperAdmin');
      }

      if (user.status === UserStatus.Suspended) {
        throw new BadRequestException(
          'Suspended users must be reinstated before approval',
        );
      }

      if (user.status === UserStatus.Approved) {
        throw new ConflictException('User is already approved');
      }

      const updatedUser = await this.databaseService.user.update({
        where: { id, status: UserStatus.Pending },
        data: { status: UserStatus.Approved },
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

  async createVolunteer(data: {
    name: string;
    email: string;
    city?: string;
    gender: Gender;
    password: string;
  }) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const email =
      typeof data.email === 'string'
        ? data.email.trim().toLowerCase()
        : '';
    const city = data.city?.trim() ?? '';

    if (!name || !email) {
      throw new BadRequestException('Name and email are required');
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

    const existingUser = await this.databaseService.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // A unique constraint on User.ploggerId is required for this retry
    // to safely resolve concurrent registrations.
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
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
        if (
          this.isPloggerIdUniqueConflict(error) &&
          attempt < maxAttempts
        ) {
          continue;
        }

        this.handleDatabaseError(error, 'create volunteer');
      }
    }

    throw new ConflictException(
      'Could not generate a unique Plogger ID. Please try again.',
    );
  }

  async getUserById(userId: number) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
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

      if (data.name !== undefined && !data.name.trim()) {
        throw new BadRequestException('Name cannot be empty');
      }

      if (data.birthDate !== undefined) {
        const date = new Date(data.birthDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (
          !data.birthDate ||
          Number.isNaN(date.getTime()) ||
          date.getTime() > today.getTime()
        ) {
          throw new BadRequestException(
            'Birth date must be a valid date that is not in the future',
          );
        }
      }

      for (const [fieldName, phoneValue] of [
        ['Phone', data.phone],
        ['Parent number', data.parentNumber],
      ] as const) {
        if (phoneValue !== undefined && phoneValue !== null) {
          const normalizedPhone = phoneValue.trim();

          if (
            normalizedPhone !== '' &&
            !/^\+?[0-9 ()-]{7,20}$/.test(normalizedPhone)
          ) {
            throw new BadRequestException(
              `${fieldName} must contain a valid phone number`,
            );
          }
        }
      }

      const updatedUser = await this.databaseService.user.update({
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
            phone: data.phone?.trim() ?? data.phone,
          }),
          ...(data.parentNumber !== undefined && {
            parentNumber: data.parentNumber?.trim() ?? data.parentNumber,
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
      const user = await this.databaseService.user.findUnique({
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

  async getAllUsers(page = 1, limit = 50) {
    this.validatePagination(page, limit);
    const skip = (page - 1) * limit;

    try {
      const [users, totalUsers, participationTotals] = await Promise.all([
        this.databaseService.user.findMany({
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
          },
          orderBy: { id: 'desc' },
          skip,
          take: limit,
        }),
        this.databaseService.user.count(),
        this.databaseService.participation.groupBy({
          by: ['userId'],
          where: { status: AttendanceStatus.Approved },
          _count: { _all: true },
          _sum: { hours: true, waste: true },
        }),
      ]);

      const totalsByUser = new Map(
        participationTotals.map((item) => [
          item.userId,
          {
            totalDrives: item._count._all,
            totalHours: item._sum.hours ?? 0,
            totalWaste: item._sum.waste ?? 0,
          },
        ]),
      );

      const formattedUsers = users.map((user) => {
        const totals = totalsByUser.get(user.id) ?? {
          totalDrives: 0,
          totalHours: 0,
          totalWaste: 0,
        };

        const score =
          totals.totalHours +
          totals.totalWaste +
          totals.totalDrives * 5;

        return {
          ...user,
          ...totals,
          drivesCount: totals.totalDrives,
          wasteKg: totals.totalWaste,
          score,
        };
      });

      return {
        message: 'Users fetched successfully',
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total: totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
        },
      };
    } catch (error: unknown) {
      this.logger.error(
        'getAllUsers error:',
        this.getErrorDetails(error),
      );

      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async getLeaderboard(page = 1, limit = 50) {
    this.validatePagination(page, limit);

    try {
      const [users, participationTotals] = await Promise.all([
        this.databaseService.user.findMany({
          where: {
            role: Role.User,
            status: UserStatus.Approved,
          },
          select: {
            id: true,
            name: true,
            ploggerId: true,
          },
        }),
        this.databaseService.participation.groupBy({
          by: ['userId'],
          where: { status: AttendanceStatus.Approved },
          _count: { _all: true },
          _sum: { hours: true, waste: true },
        }),
      ]);

      const totalsByUser = new Map(
        participationTotals.map((item) => [
          item.userId,
          {
            totalDrives: item._count._all,
            totalHours: item._sum.hours ?? 0,
            totalWaste: item._sum.waste ?? 0,
          },
        ]),
      );

      const ranked = users
        .map((user) => {
          const totals = totalsByUser.get(user.id) ?? {
            totalDrives: 0,
            totalHours: 0,
            totalWaste: 0,
          };

          const score =
            totals.totalHours +
            totals.totalWaste +
            totals.totalDrives * 5;

          return { ...user, ...totals, score };
        })
        .sort((a, b) => b.score - a.score || a.id - b.id)
        .map((user, index) => ({
          rank: index + 1,
          ...user,
        }));

      const skip = (page - 1) * limit;
      const leaderboard = ranked.slice(skip, skip + limit);

      return {
        message: 'Leaderboard fetched successfully',
        leaderboard,
        pagination: {
          page,
          limit,
          total: ranked.length,
          totalPages: Math.ceil(ranked.length / limit),
        },
      };
    } catch (error: unknown) {
      this.logger.error(
        'getLeaderboard error:',
        this.getErrorDetails(error),
      );

      throw new InternalServerErrorException('Failed to fetch leaderboard');
    }
  }

  async searchUsers(query: string, page = 1, limit = 50) {
    try {
      this.validatePagination(page, limit);

      const searchQuery = query?.trim();

      if (!searchQuery || searchQuery.length < 2) {
        throw new BadRequestException(
          'Search query must contain at least 2 characters',
        );
      }

      const where: Prisma.UserWhereInput = {
        OR: [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { email: { contains: searchQuery, mode: 'insensitive' } },
          { ploggerId: { contains: searchQuery } },
        ],
      };

      const [users, total] = await Promise.all([
        this.databaseService.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            ploggerId: true,
            role: true,
            status: true,
            createdAt: true,
          },
          orderBy: { id: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.databaseService.user.count({ where }),
      ]);

      return {
        message: 'Search results',
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
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
          date: true,
          totalHours: true,
        },
      });

      if (!drive) {
        throw new NotFoundException(
          'Drive not found or token is invalid.',
        );
      }

      // drive.date must represent the actual scheduled start timestamp.
      const now = Date.now();
      const driveStartTime = drive.date.getTime();
      const attendanceDeadline =
        driveStartTime +
        drive.totalHours * 60 * 60 * 1000 +
        2 * 60 * 60 * 1000;

      if (now < driveStartTime) {
        throw new BadRequestException(
          'Attendance cannot be marked before the drive starts.',
        );
      }

      if (now >= attendanceDeadline) {
        throw new BadRequestException(
          'The attendance window has closed.',
        );
      }

      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.status !== UserStatus.Approved) {
        throw new BadRequestException(
          'Your account must be approved before marking attendance.',
        );
      }

      // Reuse an existing registration rather than creating a duplicate.
      const existingParticipation =
        await this.databaseService.participation.findFirst({
          where: {
            userId,
            driveId: drive.id,
          },
          select: {
            id: true,
            status: true,
            attendanceMarked: true,
          },
        });

      if (existingParticipation) {
        // Do not allow a second submission or reset processed attendance.
        if (
          existingParticipation.attendanceMarked ||
          existingParticipation.status === AttendanceStatus.Approved ||
          existingParticipation.status === AttendanceStatus.Rejected
        ) {
          throw new ConflictException(
            'Attendance has already been submitted for this drive',
          );
        }

        // Atomically claim an existing unmarked registration.
        const updateResult =
          await this.databaseService.participation.updateMany({
            where: {
              id: existingParticipation.id,
              attendanceMarked: false,
              status: {
                notIn: [
                  AttendanceStatus.Approved,
                  AttendanceStatus.Rejected,
                ],
              },
            },
            data: {
              status: AttendanceStatus.Pending,
              attendanceMarked: true,
            },
          });

        if (updateResult.count !== 1) {
          throw new ConflictException(
            'Attendance has already been submitted for this drive',
          );
        }

        const attendance =
          await this.databaseService.participation.findUnique({
            where: { id: existingParticipation.id },
          });

        if (!attendance) {
          throw new NotFoundException(
            'Attendance record not found after submission',
          );
        }

        return {
          message: 'Attendance submitted for approval',
          record: attendance,
        };
      }

      // A drive can accept attendance until its deadline.
      // The database should enforce uniqueness for userId + driveId.
      const attendance =
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
        record: attendance,
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

  async drivesAttended(userId: number) {
    try {
      const participations =
        await this.databaseService.participation.findMany({
          where: { userId },
          include: {
            drive: {
              include: {
                driveLocation: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      const drives = participations.map((participation) => ({
        id: participation.drive.id,
        date: participation.drive.date,
        totalHours: participation.drive.totalHours,
        hours: participation.hours ?? 0,
        waste: participation.waste ?? 0,
        status: participation.status,
        location:
          participation.drive.driveLocation?.location ?? null,
      }));

      return {
        message: drives.length
          ? 'Drive participation fetched successfully'
          : 'No drive participation found',
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

  async promoteUser(id: number) {
    try {
      const user = await this.databaseService.user.findUnique({
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

      if (user.status === UserStatus.Suspended) {
        throw new BadRequestException(
          'Suspended users must be reinstated before promotion',
        );
      }

      const updatedUser = await this.databaseService.user.update({
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

  async getPendingAttendance(page = 1, limit = 50) {
    this.validatePagination(page, limit);
    const skip = (page - 1) * limit;

    try {
      const where: Prisma.ParticipationWhereInput = {
        status: AttendanceStatus.Pending,
        attendanceMarked: true,
      };

      const [pendingAttendance, total] = await Promise.all([
        this.databaseService.participation.findMany({
          where,
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
          skip,
          take: limit,
        }),
        this.databaseService.participation.count({ where }),
      ]);

      return {
        message: 'Pending attendance fetched successfully',
        attendance: pendingAttendance,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
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

      if (
        attendance.status !== AttendanceStatus.Pending ||
        !attendance.attendanceMarked
      ) {
        throw new BadRequestException(
          'Only submitted, pending attendance can be approved',
        );
      }

      const attendanceHours =
        hours === undefined
          ? attendance.drive.totalHours
          : hours;

      const attendanceWaste =
        waste === undefined
          ? (attendance.waste ?? 0)
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
            const result =
              await tx.participation.updateMany({
                where: {
                  id,
                  status: AttendanceStatus.Pending,
                  attendanceMarked: true,
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

            // Increment counters only after successfully approving.
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
            attendanceMarked: true,
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