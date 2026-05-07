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

    // 🔹 SEND MESSAGE (BROADCAST)
    async send(body: any) {
        if (!body.subject || !body.content) {
            throw new BadRequestException("Subject and content required");
        }
        // 1. get users
        const users = await this.db.user.findMany({
            select: { email: true },
        });

        const emails = [...new Set(
            users.map(u => u.email).filter(Boolean)
        )];

        if (emails.length === 0) {
            throw new BadRequestException("No users available to send message");
        }

        // 2. send email safely
        try {
            await this.mailService.sendBulkMail(
                emails,
                body.subject,
                body.content
            );
        } catch (err) {
            console.error("Email sending failed:", err);
            throw new BadRequestException("Failed to send emails");
        }

        // 3. store message
        return this.db.message.create({
            data: {
                subject: body.subject,
                content: body.content,
                senderId: body.senderId,
                isBroadcast: true,
            },
        });
    }
}