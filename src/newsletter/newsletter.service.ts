import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailService: MailService,
  ) {}

  async subscribe(dto: SubscribeNewsletterDto) {
    const email = dto.email.trim().toLowerCase();

    try {
      const existingSubscriber =
        await this.databaseService.newsletterSubscriber.findUnique({
          where: { email },
        });

      if (existingSubscriber) {
        if (existingSubscriber.isActive) {
          throw new ConflictException(
            'This email is already subscribed',
          );
        }

        await this.databaseService.newsletterSubscriber.update({
          where: { id: existingSubscriber.id },
          data: { isActive: true },
        });

        await this.sendConfirmationEmail(
          email,
          'Welcome back to VAF Updates!',
          'Your newsletter subscription has been reactivated.\n\n' +
            'You will now receive important updates about our plogging drives, ' +
            'community events, impact stories, and other announcements.',
        );

        return {
          message: 'Newsletter subscription reactivated successfully',
        };
      }

      await this.databaseService.newsletterSubscriber.create({
        data: { email },
      });

      await this.sendConfirmationEmail(
        email,
        'Welcome to VAF Updates!',
        "Thank you for subscribing to VAF updates.\n\n" +
          'You will now receive important updates about our plogging drives, ' +
          'community events, impact stories, and other important announcements ' +
          'directly in your inbox.\n\n' +
          "We're glad to have you with us.",
      );

      return { message: 'Subscribed successfully' };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      // Another request may have subscribed this email after our lookup.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This email is already subscribed',
        );
      }

      this.logger.error(
        'Newsletter subscription failed.',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Failed to subscribe to newsletter',
      );
    }
  }

  private async sendConfirmationEmail(
    email: string,
    subject: string,
    content: string,
  ): Promise<void> {
    try {
      await this.mailService.sendMail(email, subject, content);
    } catch (error) {
      // The subscription is already saved, so do not report it as failed
      // solely because the confirmation email could not be sent.
      this.logger.error(
        `Subscription saved, but confirmation email failed for ${email}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}