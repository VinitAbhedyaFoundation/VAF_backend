import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  AttendanceStatus,
  Prisma,
} from '@prisma/client';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly db: DatabaseService,
  ) {}

  // 🔹 GET ALL ATTENDANCE
  async getAll() {
    return this.db.participation.findMany({
      select: {
        id: true,
        userId: true,
        driveId: true,
        hours: true,
        waste: true,
        createdAt: true,
        status: true,
        attendanceMarked: true,

        user: {
          select: {
            id: true,
            name: true,
            email: true,
            ploggerId: true,
          },
        },

        drive: true,
      },
    });
  }

  // 🔹 GET MY ATTENDANCE
  async getMyAttendance(
    userId: number,
  ) {
    return this.db.participation.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        driveId: true,
        status: true,
        attendanceMarked: true,
      },
    });
  }

  // 🔹 JOIN A DRIVE
  async joinDrive(
    userId: number,
    driveId: number,
  ) {
    const drive =
      await this.db.drive.findUnique({
        where: {
          id: driveId,
        },
        select: {
          completed: true,
        },
      });

    if (!drive) {
      throw new BadRequestException(
        'Drive not found',
      );
    }

    if (drive.completed) {
      throw new BadRequestException(
        'Cannot join a completed drive',
      );
    }

    const existingParticipation =
      await this.db.participation.findUnique({
        where: {
          userId_driveId: {
            userId,
            driveId,
          },
        },
      });

    if (existingParticipation) {
      throw new BadRequestException(
        'Already joined this drive',
      );
    }

    try {
      return await this.db.participation.create({
        data: {
          userId,
          driveId,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
      });
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Already joined this drive',
        );
      }

      throw error;
    }
  }

  // 🔹 MARK ATTENDANCE
  async markAttendance(
    userId: number,
    driveId: number,
  ) {
    const drive =
      await this.db.drive.findUnique({
        where: {
          id: driveId,
        },
        select: {
          completed: true,
        },
      });

    if (!drive) {
      throw new BadRequestException(
        'Drive not found',
      );
    }

    if (!drive.completed) {
      throw new BadRequestException(
        'Attendance can only be marked after the drive is completed',
      );
    }

    const participation =
      await this.db.participation.findUnique({
        where: {
          userId_driveId: {
            userId,
            driveId,
          },
        },
        select: {
          status: true,
          attendanceMarked: true,
        },
      });

    if (!participation) {
      throw new BadRequestException(
        'Drive not joined',
      );
    }

    if (
      participation.status !==
      AttendanceStatus.Registered
    ) {
      throw new BadRequestException(
        'Attendance cannot be marked in the current state',
      );
    }

    const result =
      await this.db.participation.updateMany({
        where: {
          userId,
          driveId,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
        data: {
          attendanceMarked: true,
          status: AttendanceStatus.Pending,
        },
      });

    if (result.count === 0) {
      throw new BadRequestException(
        'Attendance already submitted',
      );
    }

    return {
      message:
        'Attendance submitted successfully',
    };
  }

  // 🔹 APPROVE ATTENDANCE
  async approveAttendance(
    id: number,
    hours: number,
    waste: number,
  ) {
    const result =
      await this.db.participation.updateMany({
        where: {
          id,
          status: AttendanceStatus.Pending,
        },
        data: {
          status: AttendanceStatus.Approved,
          attendanceMarked: true,
          hours,
          waste,
        },
      });

    if (result.count === 1) {
      return {
        message:
          'Attendance approved successfully',
      };
    }

    // Only query the record when the
    // atomic update did not succeed.
    const attendance =
      await this.db.participation.findUnique({
        where: {
          id,
        },
        select: {
          status: true,
        },
      });

    if (!attendance) {
      throw new BadRequestException(
        'Attendance record not found',
      );
    }

    if (
      attendance.status ===
      AttendanceStatus.Approved
    ) {
      throw new BadRequestException(
        'Attendance already approved',
      );
    }

    throw new BadRequestException(
      'Attendance is not pending approval',
    );
  }

  // 🔹 BULK APPROVE ATTENDANCE
  async approveBulkAttendance(
    participationIds: number[],
  ) {
    if (
      !participationIds ||
      participationIds.length === 0
    ) {
      throw new BadRequestException(
        'No attendance records selected',
      );
    }

    // Defensive protection against duplicate IDs.
    const uniqueIds = new Set(
      participationIds,
    );

    if (
      uniqueIds.size !==
      participationIds.length
    ) {
      throw new BadRequestException(
        'Duplicate attendance records selected',
      );
    }

    const participations =
      await this.db.participation.findMany({
        where: {
          id: {
            in: participationIds,
          },
        },
        select: {
          id: true,
          status: true,
          drive: {
            select: {
              totalHours: true,
            },
          },
        },
      });

    if (
      participations.length !==
      participationIds.length
    ) {
      throw new BadRequestException(
        'One or more attendance records were not found',
      );
    }

    // Preserve the existing business rule:
    // Registered and Pending records can be
    // approved through the bulk workflow.
    const invalidRecords =
      participations.filter(
        (participation) =>
          participation.status !==
            AttendanceStatus.Registered &&
          participation.status !==
            AttendanceStatus.Pending,
      );

    if (invalidRecords.length > 0) {
      throw new BadRequestException(
        'One or more attendance records cannot be approved',
      );
    }

    await this.db.$transaction(
      async (tx) => {
        for (const participation of participations) {
          const result =
            await tx.participation.updateMany({
              where: {
                id: participation.id,
                status: {
                  in: [
                    AttendanceStatus.Registered,
                    AttendanceStatus.Pending,
                  ],
                },
              },
              data: {
                status: AttendanceStatus.Approved,
                attendanceMarked: true,
                hours:
                  participation.drive.totalHours,
              },
            });

          if (result.count !== 1) {
            throw new BadRequestException(
              'One or more attendance records changed before approval',
            );
          }
        }
      },
    );

    return {
      message:
        'Attendance approved successfully',
      approvedCount:
        participations.length,
    };
  }

  // 🔹 SCAN ATTENDANCE
  async scanAttendance(
    participationId: number,
  ) {
    const participation =
      await this.db.participation.findUnique({
        where: {
          id: participationId,
        },
        select: {
          id: true,
          attendanceMarked: true,
          status: true,

          user: {
            select: {
              id: true,
              name: true,
              ploggerId: true,
            },
          },

          drive: {
            select: {
              id: true,
              title: true,
              completed: true,
            },
          },
        },
      });

    if (!participation) {
      throw new BadRequestException(
        'Invalid QR Code',
      );
    }

    if (participation.drive.completed) {
      throw new BadRequestException(
        'This drive has already been completed.',
      );
    }

    if (participation.attendanceMarked) {
      throw new BadRequestException(
        'Attendance already marked',
      );
    }

    if (
      participation.status !==
      AttendanceStatus.Registered
    ) {
      throw new BadRequestException(
        'Volunteer is not eligible for attendance.',
      );
    }

    // Atomic state transition.
    const result =
      await this.db.participation.updateMany({
        where: {
          id: participationId,
          status: AttendanceStatus.Registered,
          attendanceMarked: false,
        },
        data: {
          attendanceMarked: true,
          status: AttendanceStatus.Approved,
        },
      });

    if (result.count === 0) {
      throw new BadRequestException(
        'Attendance is no longer available for this volunteer.',
      );
    }

    return {
      success: true,
      message:
        'Attendance marked successfully',

      volunteer: {
        id: participation.user.id,
        name: participation.user.name,
        ploggerId:
          participation.user.ploggerId,
      },

      drive: {
        id: participation.drive.id,
        title:
          participation.drive.title ??
          'Drive',
      },
    };
  }
}