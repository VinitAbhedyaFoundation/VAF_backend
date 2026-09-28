import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';

import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';

@Injectable()
export class NewsletterService {
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

      return {
        message: 'Subscribed successfully',
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to subscribe to newsletter',
      );
    }
  }
}