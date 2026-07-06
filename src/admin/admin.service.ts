import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { DriveService } from '../drive/drive.service';

interface DashboardStats {
  totalVolunteers: number;
  totalDrives: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly userService: UserService,
    private readonly driveService: DriveService,
  ) {}

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Fetch users and drives in parallel
      const [users, drives] = await Promise.all([
        this.userService.getAllUsers(),
        this.driveService.findAllDrives(1, 1000), // Temporary until count APIs are available
      ]);

      const totalVolunteers = Array.isArray(users)
        ? users.length
        : 0;

      const totalDrives = Array.isArray(drives)
        ? drives.length
        : 0;

      this.logger.log(
        `Dashboard stats fetched successfully | Volunteers: ${totalVolunteers}, Drives: ${totalDrives}`,
      );

      return {
        totalVolunteers,
        totalDrives,
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch dashboard statistics',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to fetch dashboard statistics',
      );
    }
  }
}