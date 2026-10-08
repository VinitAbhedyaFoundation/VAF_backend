import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';

import { DatabaseService } from '../database/database.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(
    AdminService.name,
  );

  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    try {
      // =========================
      // BASIC DASHBOARD COUNTS
      // =========================

      const [
        totalVolunteers,
        totalDrives,
        totalHoursResult,
        wasteCollectedResult,
      ] = await Promise.all([
        this.databaseService.user.count({
          where: {
            role: Role.User,
          },
        }),

        this.databaseService.drive.count(),

        this.databaseService.participation.aggregate({
          where: {
            status: AttendanceStatus.Approved,
          },
          _sum: {
            hours: true,
          },
        }),

        this.databaseService.drive.aggregate({
          _sum: {
            totalWasteKg: true,
          },
        }),
      ]);

      const totalHours =
        totalHoursResult._sum.hours ?? 0;

      const wasteCollected =
        wasteCollectedResult._sum.totalWasteKg ?? 0;

      // =========================
      // LEADERBOARD
      // =========================
      //
      // Aggregate approved participation
      // waste per volunteer in the database.
      //

      const leaderboardGroups =
        await this.databaseService.participation.groupBy({
          by: ['userId'],
          where: {
            status: AttendanceStatus.Approved,
          },
          _sum: {
            waste: true,
          },
          _count: {
            _all: true,
          },
        });

      leaderboardGroups.sort((a, b) => {
        const wasteA = a._sum.waste ?? 0;
        const wasteB = b._sum.waste ?? 0;

        if (wasteB !== wasteA) {
          return wasteB - wasteA;
        }

        return (
          b._count._all -
          a._count._all
        );
      });

      const topLeaderboard =
        leaderboardGroups.slice(0, 5);

      const leaderboardUserIds =
        topLeaderboard.map(
          (entry) => entry.userId,
        );

      const leaderboardUsers =
        leaderboardUserIds.length > 0
          ? await this.databaseService.user.findMany(
              {
                where: {
                  id: {
                    in: leaderboardUserIds,
                  },
                },
                select: {
                  id: true,
                  name: true,
                },
              },
            )
          : [];

      const leaderboardUserMap =
        new Map(
          leaderboardUsers.map((user) => [
            user.id,
            user.name,
          ]),
        );

      const leaderboard =
        topLeaderboard.map(
          (entry, index) => ({
            name:
              leaderboardUserMap.get(
                entry.userId,
              ) ?? 'Unknown User',

            kg:
              entry._sum.waste ?? 0,

            drives:
              entry._count._all,

            rank:
              index + 1,
          }),
        );

      // =========================
      // LAST 7 DAYS
      // =========================

      const now = new Date();

      const chartMap = new Map<
        string,
        {
          waste: number;
          volunteers: number;
        }
      >();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);

        date.setHours(
          0,
          0,
          0,
          0,
        );

        date.setDate(
          date.getDate() - i,
        );

        const key =
          date
            .toISOString()
            .slice(0, 10);

        chartMap.set(key, {
          waste: 0,
          volunteers: 0,
        });
      }

      const chartDates =
        Array.from(chartMap.keys());

      const chartStartDate =
        new Date(
          `${chartDates[0]}T00:00:00`,
        );

      const chartEndDate =
        new Date(
          `${chartDates[chartDates.length - 1]}T00:00:00`,
        );

      chartEndDate.setDate(
        chartEndDate.getDate() + 1,
      );

      // =========================
      // CHART DRIVES
      // =========================

      const recentDrives =
        await this.databaseService.drive.findMany(
          {
            where: {
              completed: true,
              date: {
                gte: chartStartDate,
                lt: chartEndDate,
              },
            },
            select: {
              date: true,
              totalWasteKg: true,
            },
          },
        );

      for (const drive of recentDrives) {
        const key =
          drive.date
            .toISOString()
            .slice(0, 10);

        const day =
          chartMap.get(key);

        if (!day) {
          continue;
        }

        day.waste +=
          drive.totalWasteKg ?? 0;
      }

      // =========================
      // CHART VOLUNTEERS
      // =========================
      //
      // Count approved participations
      // belonging to drives in the last 7 days.
      //

      const recentParticipations =
        await this.databaseService.participation.findMany(
          {
            where: {
              status:
                AttendanceStatus.Approved,

              drive: {
                date: {
                  gte: chartStartDate,
                  lt: chartEndDate,
                },
              },
            },
            select: {
              drive: {
                select: {
                  date: true,
                },
              },
            },
          },
        );

      for (const participation of recentParticipations) {
        const key =
          participation.drive.date
            .toISOString()
            .slice(0, 10);

        const day =
          chartMap.get(key);

        if (!day) {
          continue;
        }

        day.volunteers += 1;
      }

      // =========================
      // FORMAT CHART DATA
      // =========================

      const chartData =
        Array.from(
          chartMap.entries(),
        ).map(
          ([date, values]) => {
            const parsedDate =
              new Date(
                `${date}T00:00:00`,
              );

            return {
              name:
                parsedDate.toLocaleDateString(
                  'en-IN',
                  {
                    weekday: 'short',
                  },
                ),

              waste:
                values.waste,

              volunteers:
                values.volunteers,
            };
          },
        );

      // =========================
      // LOG
      // =========================

      this.logger.log(
        `Dashboard stats fetched successfully | Volunteers: ${totalVolunteers}, Drives: ${totalDrives}, Hours: ${totalHours}, Waste: ${wasteCollected}`,
      );

      // =========================
      // RESPONSE
      // =========================

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