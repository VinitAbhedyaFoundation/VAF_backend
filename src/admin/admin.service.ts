import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { DriveService } from '../drive/drive.service';
import { DatabaseService } from '../database/database.service';

interface DashboardStats {
  totalVolunteers: number;
  totalDrives: number;
  totalHours: number;
  wasteCollected: number;
  chartData: {
    name: string;
    waste: number;
    volunteers: number;
  }[];
  leaderboard: {
    name: string;
    kg: number;
    drives: number;
    rank: number;
  }[];
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly userService: UserService,
    private readonly driveService: DriveService,
    private readonly databaseService: DatabaseService,
  ) {}

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Fetch all required data in parallel
      const [usersResult, drives] =
        await Promise.all([
          this.userService.getAllUsers(),
          this.driveService.findAllDrives(1, 1000),
        ]);

      const users = Array.isArray(usersResult?.users)
        ? usersResult.users
        : [];

      const totalVolunteers = users.length;

      const totalDrives = Array.isArray(drives)
        ? drives.length
        : 0;

      // Get approved participations with their drive/user data
      const approvedParticipations =
        await this.databaseService.participation.findMany({
          where: {
            status: 'Approved',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
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
        });

      // =========================
      // TOTAL HOURS
      // =========================

      const totalHours =
        approvedParticipations.reduce(
          (sum, participation) =>
            sum + (participation.hours ?? 0),
          0,
        );

      // =========================
      // TOTAL WASTE
      // =========================

      const wasteCollected =
        approvedParticipations.reduce(
          (sum, participation) =>
            sum + (participation.waste ?? 0),
          0,
        );

      // =========================
      // LEADERBOARD
      // =========================

      const leaderboardMap = new Map<
        number,
        {
          name: string;
          kg: number;
          drives: number;
        }
      >();

      for (const participation of approvedParticipations) {
        const userId = participation.user.id;
        const existing = leaderboardMap.get(userId);

        if (existing) {
          existing.kg += participation.waste ?? 0;
          existing.drives += 1;
        } else {
          leaderboardMap.set(userId, {
            name: participation.user.name,
            kg: participation.waste ?? 0,
            drives: 1,
          });
        }
      }

      const leaderboard = Array.from(
        leaderboardMap.values(),
      )
        .sort((a, b) => {
          if (b.kg !== a.kg) {
            return b.kg - a.kg;
          }

          return b.drives - a.drives;
        })
        .slice(0, 5)
        .map((user, index) => ({
          ...user,
          rank: index + 1,
        }));

      // =========================
      // WEEKLY VELOCITY
      // =========================

      const now = new Date();

      const chartMap = new Map<
        string,
        {
          waste: number;
          volunteers: number;
        }
      >();

      // Create the last 7 days first so the chart
      // still renders even when some days have no data.
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - i);

        const key = date.toISOString().slice(0, 10);

        chartMap.set(key, {
          waste: 0,
          volunteers: 0,
        });
      }

      for (const participation of approvedParticipations) {
        const driveDate = new Date(
          participation.drive.date,
        );

        const key = driveDate
          .toISOString()
          .slice(0, 10);

        const day = chartMap.get(key);

        if (!day) {
          continue;
        }

        day.waste += participation.waste ?? 0;
        day.volunteers += 1;
      }

      const chartData = Array.from(
        chartMap.entries(),
      ).map(([date, values]) => {
        const parsedDate = new Date(`${date}T00:00:00`);

        return {
          name: parsedDate.toLocaleDateString(
            'en-IN',
            {
              weekday: 'short',
            },
          ),
          waste: values.waste,
          volunteers: values.volunteers,
        };
      });

      this.logger.log(
        `Dashboard stats fetched successfully | Volunteers: ${totalVolunteers}, Drives: ${totalDrives}, Hours: ${totalHours}, Waste: ${wasteCollected}`,
      );

      return {
        totalVolunteers,
        totalDrives,
        totalHours,
        wasteCollected,
        chartData,
        leaderboard,
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