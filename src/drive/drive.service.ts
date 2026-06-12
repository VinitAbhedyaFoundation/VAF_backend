import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { randomBytes } from 'crypto';

import { DatabaseService } from '../database/database.service';

import { CreateDriveDto } from './dto/create-drive.dto';
import { CreateDriveLocationDto } from './dto/drive-location.dto';
import { UpdateDriveDto } from './dto/update-drive.dto';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(
    private databaseService: DatabaseService,
  ) { }

  // =========================
  // 🔐 SECURE TOKEN
  // =========================

  generateSecureToken(): string {
    return randomBytes(16).toString('hex');
  }

  // =========================
  // 🟢 CREATE DRIVE
  // =========================

  async createDrive(
    createDriveDto: CreateDriveDto,
  ) {
    const {
      title,
      location,
      date,
      totalHours,
    } = createDriveDto;

    try {
      const parsedDate = new Date(date);

      if (
        isNaN(parsedDate.getTime())
      ) {
        throw new BadRequestException(
          'Invalid date',
        );
      }

      const temporaryToken =
        this.generateSecureToken();

      const drive =
        await this.databaseService.drive.create(
          {
            data: {
              title,
              date: parsedDate,
              totalHours,
              temporaryToken,

              driveLocation: {
                connectOrCreate: {
                  where: {
                    location,
                  },

                  create: {
                    location,
                  },
                },
              },
            },

            include: {
              driveLocation: {
                select: {
                  location: true,
                },
              },
            },
          },
        );

      this.logger.log(
        `Drive created: ${drive.id}`,
      );

      return {
        message:
          'Drive Created Successfully',
        drive,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'Create drive failed',
      );

      throw new InternalServerErrorException(
        'Failed to create drive',
      );
    }
  }

  // =========================
  // 🟢 CREATE LOCATION
  // =========================

  async createDriveLocation(
    createDriveLocationData: CreateDriveLocationDto,
  ) {
    try {
      const driveLocation =
        await this.databaseService.driveLocation.create(
          {
            data: {
              location:
                createDriveLocationData.location,
            },

            select: {
              id: true,
              location: true,
            },
          },
        );

      this.logger.log(
        `Location created: ${driveLocation.id}`,
      );

      return {
        message:
          'Drive Location Created Successfully',
        data: driveLocation,
      };
    } catch (error) {
      this.logger.error(
        'Create location failed',
      );

      throw new InternalServerErrorException(
        'Failed to create drive location',
      );
    }
  }

  // =========================
  // 🟢 GET ALL DRIVES
  // =========================

  async findAllDrives(
    page = 1,
    limit = 10,
  ) {
    try {
      limit = Math.min(limit, 50);

      const skip = (page - 1) * limit;

      const drives =
        await this.databaseService.drive.findMany(
          {
            skip,
            take: limit,

            orderBy: {
              id: 'asc',
            },

            include: {
              driveLocation: {
                select: {
                  location: true,
                },
              },
            },
          },
        );

      return drives.map((drive) => ({
        id: drive.id,
        title: drive.title,
        date: drive.date,
        totalHours: drive.totalHours,
        volunteerCount: drive.volunteerCount,
        wasteKg: 0, // temporary until waste API is added
        location: drive.driveLocation?.location || null,
        completed: drive.completed,
      }));
    } catch (error) {
      this.logger.error(
        'Fetch drives failed',
      );

      throw new InternalServerErrorException(
        'Failed to fetch drives',
      );
    }
  }

  // =========================
  // 🟢 GET ALL LOCATIONS
  // =========================

  async findAllLocations(
    page = 1,
    limit = 10,
  ) {
    try {
      limit = Math.min(limit, 50);

      const skip = (page - 1) * limit;

      return await this.databaseService.driveLocation.findMany(
        {
          skip,
          take: limit,

          orderBy: {
            id: 'asc',
          },

          select: {
            id: true,
            location: true,
          },
        },
      );
    } catch (error) {
      this.logger.error(
        'Fetch locations failed',
      );

      throw new InternalServerErrorException(
        'Failed to fetch locations',
      );
    }
  }

  // =========================
  // 🟢 GET ONE DRIVE
  // =========================

  async findOne(id: number) {
    if (!id || id < 1) {
      throw new BadRequestException(
        'Invalid ID',
      );
    }

    try {
      const drive =
        await this.databaseService.drive.findUnique(
          {
            where: {
              id,
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
                  waste: true,
                  status: true,
                },
              },
            },
          },
        );

      if (!drive) {
        throw new BadRequestException(
          'Drive not found',
        );
      }

      return {
        id: drive.id,
        title: drive.title,
        date: drive.date,
        totalHours: drive.totalHours,
        completed: drive.completed,
        location:
          drive.driveLocation?.location ||
          null,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'Fetch drive failed',
      );

      throw new InternalServerErrorException(
        'Failed to fetch drive',
      );
    }
  }

  // =========================
  // 🟢 UPDATE DRIVE
  // =========================

  async update(
    id: number,
    updateDriveData: UpdateDriveDto,
  ) {
    if (!id || id < 1) {
      throw new BadRequestException(
        'Invalid ID',
      );
    }

    const {
      title,
      location,
      date,
      totalHours,
    } = updateDriveData;

    try {

      let parsedDate:
        | Date
        | undefined;

      if (date) {
        parsedDate = new Date(date);

        if (
          isNaN(parsedDate.getTime())
        ) {
          throw new BadRequestException(
            'Invalid date',
          );
        }
      }

      const drive =
        await this.databaseService.drive.update(
          {
            where: {
              id,
            },

            data: {
              title,
              date: parsedDate,
              totalHours,

              ...(location && {
                driveLocation: {
                  connectOrCreate: {
                    where: {
                      location,
                    },

                    create: {
                      location,
                    },
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
          },
        );

      this.logger.log(
        `Drive updated: ${drive.id}`,
      );

      return {
        message:
          'Drive Updated Successfully',
        drive,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'Update drive failed',
      );

      throw new InternalServerErrorException(
        'Failed to update drive',
      );
    }
  }

  // =========================
  // 🟢 FIND BY DATE
  // =========================

  async findByDate(date: string) {
    try {
      const parsedDate = new Date(date);

      if (
        isNaN(parsedDate.getTime())
      ) {
        throw new BadRequestException(
          'Invalid date',
        );
      }

      parsedDate.setHours(
        0,
        0,
        0,
        0,
      );

      const drives =
        await this.databaseService.drive.findMany(
          {
            where: {
              date: parsedDate,
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
                  waste: true,
                },
              },
            },
          },
        );

      if (!drives.length) {
        throw new BadRequestException(
          'No drives found',
        );
      }
      const today = new Date();

      return drives.map((drive) => {
        const volunteerCount = drive.participations.length;

        const wasteKg = drive.participations.reduce(
          (sum, p) => sum + p.waste,
          0
        );

        const hours = drive.participations.reduce(
          (sum, p) => sum + p.hours,
          0
        );

        return {
          id: drive.id,
          title: drive.title,
          date: drive.date,
          totalHours: drive.totalHours,
          volunteerCount,
          wasteKg,
          hours,
          location: drive.driveLocation?.location || null,

          status:
            new Date(drive.date) < today
              ? "Completed"
              : "Upcoming",
        };
      });

    } catch (error) {
      if (
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'Fetch by date failed',
      );

      throw new InternalServerErrorException(
        'Failed to fetch drives',
      );
    }
  }

  // =========================
  // 🟢 UPCOMING DRIVES
  // =========================

  async getUpcomingDrives() {
    try {
      const drives =
        await this.databaseService.drive.findMany({
          orderBy: {
            id: 'desc',
          },

          include: {
            driveLocation: {
              select: {
                location: true,
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
        location:
          drive.driveLocation?.location ||
          null,
      }));
    } catch (error) {
      this.logger.error(
        'Fetch upcoming drives failed',
      );

      throw new InternalServerErrorException(
        'Failed to fetch upcoming drives',
      );
    }
  }
  async completeDrive(id: number) {
    return this.databaseService.drive.update({
      where: {
        id,
      },
      data: {
        completed: true,
      },
    });
  }
}