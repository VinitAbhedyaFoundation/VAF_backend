import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import { DatabaseService } from '../database/database.service';
import { CreateDriveDto } from './dto/create-drive.dto';
import { CreateDriveLocationDto } from './dto/drive-location.dto';
import { UpdateDriveDto } from './dto/update-drive.dto';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  private readonly MAX_PAGE_SIZE = 50;

  constructor(
    private readonly databaseService: DatabaseService,
  ) { }

  // =========================
  // SECURE TOKEN
  // =========================

  private generateSecureToken(): string {
    return randomBytes(16).toString('hex');
  }

  private validateDriveId(id: number): void {
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('Invalid drive ID');
    }
  }

  private validatePagination(
    page: number,
    limit: number,
  ): { skip: number; limit: number } {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1
    ) {
      throw new BadRequestException(
        'Page and limit must be positive integers',
      );
    }

    const safeLimit = Math.min(limit, this.MAX_PAGE_SIZE);

    return {
      skip: (page - 1) * safeLimit,
      limit: safeLimit,
    };
  }

  private isRecordNotFoundError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2025';
    }

    // Also handles structurally mocked Prisma errors in tests.
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2025'
    );
  }

  // =========================
  // CREATE DRIVE
  // =========================

  async createDrive(createDriveDto: CreateDriveDto) {
    const { title, location, date, totalHours } = createDriveDto;

    try {
      const parsedDate = new Date(date);

      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Invalid date');
      }

      const temporaryToken = this.generateSecureToken();

      const drive = await this.databaseService.drive.create({
        data: {
          title,
          date: parsedDate,
          totalHours,
          temporaryToken,
          driveLocation: {
            connectOrCreate: {
              where: { location },
              create: { location },
            },
          },
        },
        include: {
          driveLocation: {
            select: { location: true },
          },
        },
      });

      this.logger.log(`Drive created: ${drive.id}`);

      return {
        message: 'Drive Created Successfully',
        drive,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        'Create drive failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Failed to create drive');
    }
  }

  // =========================
  // CREATE LOCATION
  // =========================

  async createDriveLocation(
    createDriveLocationData: CreateDriveLocationDto,
  ) {
    try {
      const driveLocation =
        await this.databaseService.driveLocation.create({
          data: {
            location: createDriveLocationData.location,
          },
          select: {
            id: true,
            location: true,
          },
        });

      this.logger.log(`Location created: ${driveLocation.id}`);

      return {
        message: 'Drive Location Created Successfully',
        data: driveLocation,
      };
    } catch (error) {
      this.logger.error(
        'Create location failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Failed to create drive location',
      );
    }
  }

  // =========================
  // GET ALL DRIVES
  // =========================

  async findAllDrives(page = 1, limit = 10) {
    try {
      const pagination = this.validatePagination(page, limit);

      const drives = await this.databaseService.drive.findMany({
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: {
          id: 'asc',
        },
        include: {
          driveLocation: {
            select: {
              location: true,
            },
          },
          participations: {
            select: {
              hours: true,
              status: true,
            },
          },
        },
      });

      return drives.map((drive) => {
        const approvedParticipations = drive.participations.filter(
          (participation) => participation.status === 'Approved',
        );

        const volunteerCount = approvedParticipations.length;

        return {
          id: drive.id,
          title: drive.title,
          date: drive.date,
          totalHours: drive.totalHours,
          volunteerCount,
          wasteKg: drive.totalWasteKg ?? 0,
          totalWasteKg: drive.totalWasteKg ?? 0,
          location: drive.driveLocation?.location ?? null,
          completed: drive.completed,
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        'Fetch drives failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Failed to fetch drives');
    }
  }

  // =========================
  // GET ALL LOCATIONS
  // =========================

  async findAllLocations(page = 1, limit = 10) {
    try {
      const pagination = this.validatePagination(page, limit);

      return await this.databaseService.driveLocation.findMany({
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          location: true,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        'Fetch locations failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Failed to fetch locations',
      );
    }
  }

  // =========================
  // GET ONE DRIVE
  // =========================

  async findOne(id: number) {
    this.validateDriveId(id);

    try {
      const drive = await this.databaseService.drive.findUnique({
        where: { id },
        include: {
          driveLocation: {
            select: {
              location: true,
            },
          },
          participations: {
            select: {
              hours: true,
              status: true,
            },
          },
        },
      });

      if (!drive) {
        throw new NotFoundException('Drive not found');
      }

      return {
        id: drive.id,
        title: drive.title,
        date: drive.date,
        totalHours: drive.totalHours,
        totalWasteKg: drive.totalWasteKg ?? 0,
        wasteKg: drive.totalWasteKg ?? 0,
        completed: drive.completed,
        location: drive.driveLocation?.location ?? null,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        'Fetch drive failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Failed to fetch drive');
    }
  }

  // =========================
  // UPDATE DRIVE
  // =========================

  async update(id: number, updateDriveData: UpdateDriveDto) {
    this.validateDriveId(id);

    const { title, location, date, totalHours } = updateDriveData;

    try {
      let parsedDate: Date | undefined;

      if (date !== undefined && date !== null) {
        parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
          throw new BadRequestException('Invalid date');
        }
      }

      const drive = await this.databaseService.drive.update({
        where: { id },
        data: {
          title,
          date: parsedDate,
          totalHours,
          ...(location !== undefined && {
            driveLocation: {
              connectOrCreate: {
                where: { location },
                create: { location },
              },
            },
          }),
        },
        include: {
          driveLocation: {
            select: {
              location: true,
            },
          },
        },
      });

      this.logger.log(`Drive updated: ${drive.id}`);

      return {
        message: 'Drive Updated Successfully',
        drive,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (this.isRecordNotFoundError(error)) {
        throw new NotFoundException('Drive not found');
      }

      this.logger.error(
        'Update drive failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Failed to update drive');
    }
  }

  // =========================
  // FIND BY DATE
  // =========================

  async findByDate(date: string) {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    parsedDate.setHours(0, 0, 0, 0);

    const endOfDay = new Date(parsedDate);
    endOfDay.setDate(endOfDay.getDate() + 1);

    try {
      const drives = await this.databaseService.drive.findMany({
        where: {
          date: {
            gte: parsedDate,
            lt: endOfDay,
          },
        },
        include: {
          driveLocation: {
            select: {
              location: true,
            },
          },
          participations: {
            select: {
              hours: true,
              status: true,
            },
          },
        },
      });

      if (drives.length === 0) {
        throw new NotFoundException('No drives found for this date');
      }

      const today = new Date();

      return drives.map((drive) => {
        const approvedParticipations = drive.participations.filter(
          (participation) => participation.status === 'Approved',
        );

        const volunteerCount = approvedParticipations.length;

        const hours = approvedParticipations.reduce(
          (sum, participation) => sum + (participation.hours ?? 0),
          0,
        );

        return {
          id: drive.id,
          title: drive.title,
          date: drive.date,
          totalHours: drive.totalHours,
          wasteKg: drive.totalWasteKg ?? 0,
          totalWasteKg: drive.totalWasteKg ?? 0,
          volunteerCount,
          hours,
          location: drive.driveLocation?.location ?? null,
          status: new Date(drive.date) < today ? 'Completed' : 'Upcoming',
        };
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        'Fetch by date failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Failed to fetch drives');
    }
  }

  // =========================
  // UPCOMING DRIVES
  // =========================

  async getUpcomingDrives() {
    try {
      const drives = await this.databaseService.drive.findMany({
        where: {
          date: {
            gte: new Date(),
          },
          completed: false,
        },
        orderBy: {
          date: 'asc',
        },
        include: {
          driveLocation: {
            select: {
              location: true,
            },
          },
          participations: {
            select: {
              hours: true,
              status: true,
            },
          },
        },
      });

      return drives.map((drive) => ({
        id: drive.id,
        title: drive.title,
        date: drive.date,
        totalHours: drive.totalHours,
        completed: drive.completed,
        location: drive.driveLocation?.location ?? null,
      }));
    } catch (error) {
      this.logger.error(
        'Fetch upcoming drives failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Failed to fetch drives');
    }
  }

  // =========================
  // COMPLETE DRIVE
  // =========================

  async completeDrive(id: number, totalWasteKg: number) {
    this.validateDriveId(id);

    if (
      typeof totalWasteKg !== 'number' ||
      !Number.isFinite(totalWasteKg) ||
      totalWasteKg < 0
    ) {
      throw new BadRequestException(
        'Total waste collected must be a valid non-negative number',
      );
    }

    try {
      const drive = await this.databaseService.drive.update({
        where: { id },
        data: {
          completed: true,
          totalWasteKg,
        },
      });

      this.logger.log(
        `Drive completed: ${drive.id} | Total waste: ${drive.totalWasteKg} kg`,
      );

      return drive;
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        throw new NotFoundException('Drive not found');
      }

      this.logger.error(
        'Complete drive failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Failed to complete drive');
    }
  }
}
