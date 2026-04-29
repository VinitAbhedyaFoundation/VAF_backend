import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getUserDashboard(userId: number) {
    // 👤 Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // 📊 Get participation data
    const participations = await this.prisma.participation.findMany({
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

    // 📊 Stats
    const drivesJoined = participations.length;

    const hoursVolunteered = participations.reduce(
      (sum, p) => sum + (p.hours || 0),
      0,
    );

    const wasteCollected = participations.reduce(
      (sum, p) => sum + (p.waste || 0),
      0,
    );

    const impactPoints = wasteCollected * 4;

    // 🧠 Activity (group by date)
    const activityMap: Record<string, any> = {};

    participations.forEach((p) => {
      const date = p.createdAt.toISOString().split('T')[0];

      if (!activityMap[date]) {
        activityMap[date] = {
          date,
          hours: 0,
          waste: 0,
        };
      }

      activityMap[date].hours += p.hours || 0;
      activityMap[date].waste += p.waste || 0;
    });

    const activity = Object.values(activityMap);

    // 📋 Recent Drives
    const recentDrives = participations
      .slice(-3)
      .reverse()
      .map((p) => ({
        title: p.drive?.driveLocation?.location || 'Drive',
        location: p.drive?.driveLocation?.location || 'Unknown',
        date: p.drive?.date,
        hours: p.hours || 0,
      }));

    return {
      user: {
        name: user?.name || 'User',
        streakWeeks: 4,
        certificates: 3,
      },
      stats: {
        drivesJoined,
        hoursVolunteered,
        wasteCollected,
        impactPoints,
      },
      milestone: {
        level: 'Platinum',
        completed: drivesJoined,
        total: 12,
      },
      recentDrives,
      activity,
    };
  }
}