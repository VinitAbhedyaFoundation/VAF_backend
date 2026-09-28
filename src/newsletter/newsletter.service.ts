import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

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
        if (!existingSubscriber.isActive) {
          await this.databaseService.newsletterSubscriber.update({
            where: { id: existingSubscriber.id },
            data: { isActive: true },
          });

          try {
            await this.mailService.sendMail(
              email,
              'Welcome back to VAF Updates!',
              `
                <p>Your newsletter subscription has been reactivated.</p>

                <p>
                  You will now receive important updates about our
                  plogging drives, community events, impact stories,
                  and other announcements.
                </p>
              `,
            );
          } catch (error) {
            this.logger.error(
              `Subscriber reactivated, but confirmation email failed for ${email}.`,
              error instanceof Error ? error.stack : String(error),
            );
          }

          return {
            message: 'Newsletter subscription reactivated successfully',
          };
        }

        throw new ConflictException('This email is already subscribed');
      }

      await this.databaseService.newsletterSubscriber.create({
        data: {
          email,
        },
      });

      try {
        await this.mailService.sendMail(
          email,
          'Welcome to VAF Updates!',
          `
            <p>Thank you for subscribing to VAF updates.</p>

            <p>
              You will now receive important updates about our
              plogging drives, community events, impact stories,
              and other important announcements directly in your inbox.
            </p>

            <p>
              We're glad to have you with us.
            </p>
          `,
        );
      } catch (error) {
        this.logger.error(
          `Subscriber created, but confirmation email failed for ${email}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }

      return {
        message: 'Subscribed successfully',
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
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
}