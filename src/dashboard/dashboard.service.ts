import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: DatabaseService,
  ) { }

  async getUserDashboard(userId: number) {
    // 🔹 Get user
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

    // 🔹 Get participations
    const participations =
      await this.prisma.participation.findMany({
        where: { userId },

        include: {
          drive: {
            include: {
              driveLocation: true,
            },
          },
        },

        orderBy: {
          createdAt: 'asc',
        },
      });

    // =========================
    // 📊 Stats
    // =========================

    const drivesJoined =
      participations.filter(
        (p) => p.status === 'Approved',
      ).length;

    const hoursVolunteered =
      participations.reduce(
        (
          sum: number,
          p: any,
        ) => sum + (p.hours ?? 0),
        0,
      );

    const wasteCollected =
      participations.reduce(
        (
          sum: number,
          p: any,
        ) => sum + (p.waste ?? 0),
        0,
      );

    const impactPoints =
      wasteCollected * 4;

    // =========================
    // 🧠 Activity
    // =========================

    const activityMap: Record<
      string,
      {
        date: string;
        hours: number;
        waste: number;
        location: string;
      }
    > = {};

    participations.forEach((p: any) => {
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
            p.drive?.driveLocation?.location ||
            'Unknown',
        };
      }

      activityMap[date].hours +=
        p.hours ?? 0;

      activityMap[date].waste +=
        p.waste ?? 0;
    });

    const activity =
      Object.values(activityMap);

    // =========================
    // 📋 Recent Drives
    // =========================

    const recentDrives =
      participations
        .filter(
          (p) => p.status === 'Approved',
        )
        .slice(-3)
        .reverse()
        .map((p: any) => ({
          title:
            p.drive?.title ||
            'Drive',

          location:
            p.drive
              ?.driveLocation
              ?.location ||
            'Unknown',

          date:
            p.drive?.date ||
            null,

          hours:
            p.hours ?? 0,
        }));

    // =========================
    // 🏆 Certificates
    // =========================

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
      certificateRecords.map((c: any) => ({
        id: c.id,

        title: `${c.drive?.title || 'Drive'
          } Participation`,

        drive:
          c.drive?.title || 'Drive',

        issueDate:
          c.issuedAt,

        fileUrl:
          c.fileUrl,

        type:
          'participation',
      }));

    // =========================
    // 🚀 Final Response
    // =========================

    return {
      user: {
        name:
          user?.name ||
          'User',

        streakWeeks: 0,

        certificates:
          certificates.length,
      },

      stats: {
        drivesJoined,
        hoursVolunteered,
        wasteCollected,
        impactPoints,
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
  }

  private getMilestoneLevel(
    drives: number,
  ): string {
    if (drives >= 50)
      return 'Diamond';

    if (drives >= 25)
      return 'Platinum';

    if (drives >= 10)
      return 'Gold';

    if (drives >= 5)
      return 'Silver';

    return 'Bronze';
  }
}