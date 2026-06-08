import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { Injectable, BadRequestException } from '@nestjs/common';


@Injectable()
export class MessageService {
    constructor(
        private db: DatabaseService,
        private mailService: MailService
    ) { }

    // 🔹 GET ALL MESSAGES
    async getAll() {
        return this.db.message.findMany({
            include: {
                sender: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

    }

    async getNotifications(
    userId: number,
) {
    return this.db.notification.findMany({
        where: {
            userId,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}

    // 🔹 SEND MESSAGE (BROADCAST)
    async send(body: any) {
        if (!body.subject || !body.content) {
            throw new BadRequestException(
                "Subject and content required"
            );
        }

        // 1. Get users
        const users = await this.db.user.findMany({
            select: {
                id: true,
                email: true,
                status: true,
            },
        });

        const emails = [
            ...new Set(
                users
                    .map((u) => u.email)
                    .filter(Boolean)
            ),
        ];

        if (emails.length === 0) {
            throw new BadRequestException(
                "No users available to send message"
            );
        }

        // 2. Send email
        try {
            await this.mailService.sendBulkMail(
                emails,
                body.subject,
                body.content
            );
        } catch (err) {
            console.error(
                "Email sending failed:",
                err
            );

            throw new BadRequestException(
                "Failed to send emails"
            );
        }

        // 3. Store message
        const message =
            await this.db.message.create({
                data: {
                    subject: body.subject,
                    content: body.content,
                    senderId: body.senderId,
                    isBroadcast: true,
                },
            });

        // 4. Create notifications
        const approvedUsers = users.filter(
            (user) =>
                user.status === "Approved"
        );

        if (approvedUsers.length > 0) {
            await this.db.notification.createMany({
                data: approvedUsers.map(
                    (user) => ({
                        userId: user.id,
                        title: body.subject,
                        message: body.content,
                    })
                ),
            });
        }

        return message;
    }
}