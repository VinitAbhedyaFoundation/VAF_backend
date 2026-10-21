
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
  ) {}

  async getAll() {
    return this.db.message.findMany({
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getNotifications(userId: number) {
    return this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async send(body: CreateMessageDto, senderId: number) {
    if (!body.subject?.trim() || !body.content?.trim()) {
      throw new BadRequestException(
        'Subject and content are required',
      );
    }

    if (!Number.isInteger(senderId) || senderId <= 0) {
      throw new BadRequestException('Invalid sender ID');
    }

    const approvedUsers = await this.db.user.findMany({
      where: { status: UserStatus.Approved },
      select: {
        id: true,
        email: true,
      },
    });

    const emails = [
      ...new Set(
        approvedUsers
          .map((user) => user.email)
          .filter((email): email is string => Boolean(email)),
      ),
    ];

    if (emails.length === 0) {
      throw new BadRequestException(
        'No approved volunteers with email addresses are available to receive this message',
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
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Unable to send broadcast emails. Please try again later.',
      );
    }

    const message = await this.db.message.create({
      data: {
        subject: body.subject,
        content: body.content,
        senderId,
        recipients: approvedUsers.length,
        isBroadcast: true,
      },
    });

    await this.db.notification.createMany({
      data: approvedUsers.map((user) => ({
        userId: user.id,
        title: body.subject,
        message: body.content,
      })),
    });

    this.logger.log(
      `Broadcast message sent to ${approvedUsers.length} approved users.`,
    );

    return message;
  }
}
