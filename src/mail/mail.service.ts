import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(
    MailService.name,
  );

  private readonly transporter =
    nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

  async onModuleInit(): Promise<void> {
    if (
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      this.logger.warn(
        'Email credentials are not configured.',
      );
      return;
    }

    try {
      await this.transporter.verify();

      this.logger.log(
        'Mail server is ready.',
      );
    } catch (error) {
      this.logger.error(
        'Mail server verification failed.',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }

  async sendBulkMail(
    to: string[],
    subject: string,
    content: string,
  ): Promise<void> {
    if (!to.length) {
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"VAF Portal" <${process.env.EMAIL_USER}>`,
        bcc: to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>${subject}</h2>
            <p>${content}</p>
            <hr />
            <small>Sent via VAF Portal</small>
          </div>
        `,
      });

      this.logger.log(
        `Email sent successfully to ${to.length} recipient(s).`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send bulk email.',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }
}