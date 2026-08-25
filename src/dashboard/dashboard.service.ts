import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(
    DashboardService.name,
  );

  private readonly DEFAULT_DRIVE = 'Drive';
  private readonly UNKNOWN_LOCATION = 'Unknown';

  constructor(
    private readonly prisma: DatabaseService,
  ) { }

  async getUserDashboard(userId: number) {
    try {
      const user =
        await this.prisma.user.findUnique({
          where: {
            id: userId,
          },
        });

      if (!user) {
        throw new NotFoundException(
          'User not found',
        );
      }

      const participations =
        await this.prisma.participation.findMany({
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
          orderBy: {
            createdAt: 'desc',
          },
        });

      const completedParticipations = participations.filter(
        (p) =>
          p.status === 'Approved' &&
          p.attendanceMarked,
      );

      const drivesJoined =
        completedParticipations.length;

      const hoursVolunteered =
        completedParticipations.reduce(
          (sum: number, p: any) =>
            sum + (p.hours ?? 0),
          0,
        );

      const wasteCollected =
        completedParticipations.reduce(
          (sum: number, p: any) =>
            sum + (p.waste ?? 0),
          0,
        );

      const activityMap: Record<
        string,
        {
          date: string;
          hours: number;
          waste: number;
          location: string;
        }
      > = {};

      completedParticipations.forEach((p: any) => {
        const date =
          p.drive?.date
            ?.toISOString()
            .split('T')[0] ??
          p.createdAt
            .toISOString()
            .split('T')[0];

        if (!activityMap[date]) {
          activityMap[date] = {
            date,
            hours: 0,
            waste: 0,
            location:
              p.drive?.driveLocation
                ?.location ??
              this.UNKNOWN_LOCATION,
          };
        }

        activityMap[date].hours +=
          p.hours ?? 0;

        activityMap[date].waste +=
          p.waste ?? 0;
      });

      const activity =
        Object.values(activityMap);

      const recentDrives =
        [...completedParticipations]
          .reverse()
          .map((p: any) => ({
    participationId: p.id,

    driveId: p.driveId,

    attendanceMarked: p.attendanceMarked,

    title: p.drive?.title ?? this.DEFAULT_DRIVE,

    location:
        p.drive?.driveLocation?.location ??
        this.UNKNOWN_LOCATION,

    date: p.drive?.date ?? null,

    hours: p.hours ?? 0,

    status: p.status,
}));

      const certificateRecords =
        await this.prisma.certificate.findMany({
          where: {
            userId,
          },
          include: {
            drive: true,
          },
          orderBy: {
            issuedAt: 'desc',
          },
        });

      const certificates =
        certificateRecords.map(
          (c: any) => ({
            id: c.id,

            title: `${c.drive?.title ??
              this.DEFAULT_DRIVE
              } Participation`,

            drive:
              c.drive?.title ??
              this.DEFAULT_DRIVE,

            issueDate:
              c.issuedAt,

            fileUrl:
              c.fileUrl,

            type:
              'participation',
          }),
        );

      return {
        user: {
          name:
            user.name ?? 'User',

          streakWeeks: 0,

          certificates:
            certificates.length,
        },

        stats: {
          drivesJoined,
          hoursVolunteered,
          wasteCollected,
        },

        milestone: {
          level:
            this.getMilestoneLevel(
              drivesJoined,
            ),
          completed:
            drivesJoined,
        },

        recentDrives,
        activity,
        certificates,
      };
    } catch (error) {
      this.logger.error(
        `Failed to load dashboard for user ${userId}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  private getMilestoneLevel(
    drives: number,
  ): string {
    if (drives >= 50) {
      return 'Diamond';
    }

    if (drives >= 25) {
      return 'Platinum';
    }

    if (drives >= 10) {
      return 'Gold';
    }

    if (drives >= 5) {
      return 'Silver';
    }

    return 'Bronze';
  }
}