import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateDriveDto } from './dto/create-drive.dto';
import { CreateDriveLocationDto } from './dto/drive-location.dto';
import { DatabaseService } from '../database/database.service';
import { UpdateDriveDto } from './dto/update-drive.dto';

@Injectable()
export class DriveService {
  constructor(private databaseService: DatabaseService) { }

 async createDrive(createDriveDto: CreateDriveDto) {
  const { locationId, date, totalHours, expiryDate, title } = createDriveDto;

  try {
    const isLocationIdValid = await this.databaseService.driveLocation.findUnique({
      where: { id: locationId }
    });

    if (!isLocationIdValid) {
      throw new BadRequestException('Invalid Location Id');
    }

    const temporaryToken = this.generateOtp();

    const drive = await this.databaseService.drive.create({
      data: {
        title,
        date,
        totalHours,
        expiryDate,
        temporaryToken,

        driveLocation: {
          connect: { id: locationId },
        },
      }
    });

    return {
      message: 'Drive Created Successfully',
      drive,
    };

  } catch (error) {
    console.error("🔥 ERROR in createDrive:", error);
    throw error;
  }
}

  async createDriveLocation(createDriveLocationData: CreateDriveLocationDto) {
    const location = createDriveLocationData.location;
    try {
      const driveLocation = await this.databaseService.driveLocation.create({
        data: { location }
      });

      return {
        message: 'Drive Location Created Successfully',
        data: driveLocation,
      };

    } catch (error) {
      console.error("🔥 ERROR in createDriveLocation:", error);
      throw error;
    }
  }

  async findAllDrives() {
    try {
      const drives = await this.databaseService.drive.findMany({
        orderBy: { id: 'asc' }
      });

      const drivesWithLocations = await Promise.all(
        drives.map(async (drive) => {
          const location = await this.databaseService.driveLocation.findUnique({
            where: { id: drive.locationId },
          });

          return {
            ...drive,
            location: location?.location || "Unknown",
          };
        })
      );

      return drivesWithLocations;

    } catch (error) {
      console.error('🔥 Error fetching drives:', error);
      throw error;
    }
  }

  async findAllLocations() {
    try {
      return await this.databaseService.driveLocation.findMany({
        orderBy: { id: 'asc' }
      });
    } catch (error) {
      console.error('🔥 Error fetching locations:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    try {
      const drive = await this.databaseService.drive.findUnique({
        where: { id }
      });

      if (!drive) {
        throw new BadRequestException('Drive not found');
      }

      return {
        message: 'Drive Found',
        drive,
      };

    } catch (error) {
      console.error('🔥 Error fetching drive:', error);
      throw error;
    }
  }

  async update(id: number, updateDriveData: UpdateDriveDto) {
    const { locationId, date, totalHours, expiryDate } = updateDriveData;

    try {
      const drive = await this.databaseService.drive.update({
        where: { id },
        data: {
          date,
          locationId,
          totalHours,
          expiryDate,
        }
      });

      return {
        message: 'Drive Updated Successfully',
        drive,
      };

    } catch (error) {
      console.error('🔥 Error updating drive:', error);
      throw error;
    }
  }

  async findByDate(date: string) {
    try {
      const driveDate = new Date(date);

      const drives = await this.databaseService.drive.findMany({
        where: { date: driveDate }
      });

      if (drives.length === 0) {
        throw new BadRequestException('No drives found for this date');
      }

      return {
        message: 'Drives found',
        drives,
      };

    } catch (error) {
      console.error('🔥 Error fetching drives by date:', error);
      throw error;
    }
  }

  // ✅ FINAL FIXED METHOD
async getUpcomingDrives() {
  try {
    const drives = await this.databaseService.drive.findMany({
      where: {
        date: {
          gte: new Date(),
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    const result = await Promise.all(
      drives.map(async (drive) => {
        const location = await this.databaseService.driveLocation.findUnique({
          where: { id: drive.locationId },
        });

        return {
          id: drive.id,
          title: drive.title, // ✅ FIX ADDED
          date: drive.date,
          totalHours: drive.totalHours,
          expiryDate: drive.expiryDate,
          location: location?.location || "Unknown",
        };
      })
    );

    return result;

  } catch (error) {
    console.error("🔥 REAL ERROR:", error);
    throw error;
  }
}

  generateOtp() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let otp = '';

    for (let i = 0; i < 6; i++) {
      otp += chars[Math.floor(Math.random() * chars.length)];
    }

    return otp;
  }
}