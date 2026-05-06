import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { DriveService } from 'src/drive/drive.service';

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
      // 🚀 Fetch in parallel (faster)
      const [users, drives] = await Promise.all([
        this.userService.getAllUsers(),
        this.driveService.findAllDrives(1, 1000), // temporary large fetch
      ]);

      // ✅ Enforce array shape (minimal fallback)
      const safeUsers = Array.isArray(users) ? users : [];
      const safeDrives = Array.isArray(drives) ? drives : [];

      return {
        totalVolunteers: safeUsers.length,
        totalDrives: safeDrives.length,
      };

    } catch (error) {
      this.logger.error('Failed to fetch dashboard stats', error);

      throw new InternalServerErrorException(
        'Unable to fetch dashboard statistics',
      );
    }
  }
}