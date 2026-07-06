import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';

import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(
    MessageService.name,
  );

  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
  ) {}

  // =========================
  // 📨 GET ALL MESSAGES
  // =========================

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

  // =========================
  // 🔔 GET USER NOTIFICATIONS
  // =========================

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

  // =========================
  // 📧 SEND BROADCAST MESSAGE
  // =========================

  async send(
    body: CreateMessageDto,
  ) {
    if (
      !body.subject ||
      !body.content
    ) {
      throw new BadRequestException(
        'Subject and content are required',
      );
    }

    const users =
      await this.db.user.findMany({
        select: {
          id: true,
          email: true,
          status: true,
        },
      });

    const emails = [
      ...new Set(
        users
          .map((user) => user.email)
          .filter(Boolean),
      ),
    ];

    if (!emails.length) {
      throw new BadRequestException(
        'No users available to send message',
      );
    }

    try {
      await this.mailService.sendBulkMail(
        emails,
        body.subject,
        body.content,
      );
    } catch (error) {
      this.logger.error(
        'Email sending failed',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new BadRequestException(
        'Failed to send emails',
      );
    }

    const message =
      await this.db.message.create({
        data: {
          subject: body.subject,
          content: body.content,
          senderId: body.senderId,
          isBroadcast: true,
        },
      });

    const approvedUsers =
      users.filter(
        (user) =>
          user.status ===
          UserStatus.Approved,
      );

    if (approvedUsers.length) {
      await this.db.notification.createMany({
        data: approvedUsers.map(
          (user) => ({
            userId: user.id,
            title: body.subject,
            message: body.content,
          }),
        ),
      });
    }

    this.logger.log(
      `Broadcast message sent to ${approvedUsers.length} users.`,
    );

    return message;
  }
}