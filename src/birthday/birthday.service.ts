
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Role, UserStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class BirthdayService {
    private readonly logger = new Logger(BirthdayService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly mailService: MailService,
    ) { }

    @Cron('0 7 * * *', {
        timeZone: 'Asia/Kolkata',
    })
    async sendBirthdayWishes(): Promise<void> {
        this.logger.log('Starting daily birthday notification job.');

        try {
            const today = new Date();

            // Birth dates are stored as DateTime values created from YYYY-MM-DD.
            // Use UTC components to preserve the calendar date entered by volunteers.
            const todayMonth = today.getMonth() + 1;
            const todayDay = today.getDate();

            const [volunteers, admins] = await Promise.all([
                this.databaseService.user.findMany({
                    where: {
                        role: Role.User,
                        status: UserStatus.Approved,
                        birthDate: {
                            not: null,
                        },
                    },
                    select: {
                        name: true,
                        email: true,
                        birthDate: true,
                    },
                }),

                this.databaseService.user.findMany({
                    where: {
                        role: {
                            in: [Role.Admin, Role.SuperAdmin],
                        },
                        status: UserStatus.Approved,
                    },
                    select: {
                        email: true,
                    },
                }),
            ]);

            const adminEmails = [
                ...new Set(
                    admins
                        .map((admin) => admin.email.trim())
                        .filter((email) =>
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
                        ),
                ),
            ];

            const birthdayVolunteers = volunteers.filter((volunteer) => {
                if (!volunteer.birthDate) {
                    return false;
                }

                return (
                    volunteer.birthDate.getUTCMonth() + 1 === todayMonth &&
                    volunteer.birthDate.getUTCDate() === todayDay
                );
            });

            if (birthdayVolunteers.length === 0) {
                this.logger.log('No volunteer birthdays today.');
                return;
            }

            let sentCount = 0;
            let failedCount = 0;

            for (const volunteer of birthdayVolunteers) {
                const email = volunteer.email.trim();

                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    this.logger.warn(
                        'Skipping a birthday notification because the volunteer email is invalid.',
                    );
                    failedCount++;
                    continue;
                }

                try {
                    await this.mailService.sendMail(
                        email,
                        'Happy Birthday from Vinit Abhedya Foundation!',
                        `Dear ${volunteer.name},

Wishing you a very Happy Birthday!

May your special day bring you happiness, good health, and success. Thank you for being a valued part of the Vinit Abhedya Foundation family and for contributing to our mission.

Keep making a difference!

Warm regards,
Team Vinit Abhedya Foundation`,
                        adminEmails,
                    );

                    sentCount++;
                } catch (error) {
                    failedCount++;

                    this.logger.error(
                        'Failed to send a birthday notification.',
                        error instanceof Error ? error.message : String(error),
                    );
                }
            }

            this.logger.log(
                `Birthday notification job completed. Sent: ${sentCount}, Failed: ${failedCount}.`,
            );
        } catch (error) {
            this.logger.error(
                'Birthday notification job failed.',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
