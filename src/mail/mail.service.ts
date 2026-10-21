
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);

  private readonly transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  async onModuleInit(): Promise<void> {
    if (!this.isEmailConfigured()) {
      this.logger.warn(
        'Email credentials are not configured. Email sending is disabled.',
      );
      return;
    }

    try {
      await this.transporter.verify();
      this.logger.log('Mail server is ready.');
    } catch (error) {
      this.logger.error(
        'Mail server verification failed. The application will continue, but email delivery may be unavailable.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private isEmailConfigured(): boolean {
    return Boolean(
      process.env.EMAIL_USER?.trim() &&
      process.env.EMAIL_PASS?.trim(),
    );
  }

  private ensureEmailConfigured(): void {
    if (!this.isEmailConfigured()) {
      throw new ServiceUnavailableException(
        'Email service is not configured. Set EMAIL_USER and EMAIL_PASS in the environment.',
      );
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };

      return entities[char];
    });
  }

  private validateEmailAddress(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async sendMail(
    to: string,
    subject: string,
    content: string,
  ): Promise<void> {
    this.ensureEmailConfigured();

    if (!to?.trim() || !this.validateEmailAddress(to.trim())) {
      throw new BadRequestException(
        'A valid recipient email address is required.',
      );
    }

    if (!subject?.trim()) {
      throw new BadRequestException(
        'Email subject cannot be empty.',
      );
    }

    if (typeof content !== 'string' || !content.trim()) {
      throw new BadRequestException(
        'Email content cannot be empty.',
      );
    }

    try {
      await this.transporter.sendMail({
        from: `"VAF Portal" <${process.env.EMAIL_USER}>`,
        to: to.trim(),
        subject,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>${this.escapeHtml(subject)}</h2>
            <p>${this.escapeHtml(content).replace(/\r?\n/g, '<br>')}</p>
            <hr />
            <small>Sent via VAF Portal</small>
          </div>
        `,
      });

      this.logger.log(`Email sent successfully to ${to.trim()}.`);
    } catch (error) {
      this.logger.error(
        'Failed to send email.',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async sendBulkMail(
    to: string[],
    subject: string,
    content: string,
  ): Promise<void> {
    this.ensureEmailConfigured();

    if (!Array.isArray(to) || to.length === 0) {
      throw new BadRequestException(
        'At least one recipient email address is required.',
      );
    }

    const recipients = to.map((email) =>
      typeof email === 'string' ? email.trim() : '',
    );

    const invalidRecipients = recipients.filter(
      (email) => !this.validateEmailAddress(email),
    );

    if (invalidRecipients.length > 0) {
      throw new BadRequestException(
        'One or more recipient email addresses are invalid.',
      );
    }

    if (!subject?.trim()) {
      throw new BadRequestException(
        'Email subject cannot be empty.',
      );
    }

    if (typeof content !== 'string' || !content.trim()) {
      throw new BadRequestException(
        'Email content cannot be empty.',
      );
    }

    try {
      await this.transporter.sendMail({
        from: `"VAF Portal" <${process.env.EMAIL_USER}>`,
        bcc: recipients,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>${this.escapeHtml(subject)}</h2>
            <p>${this.escapeHtml(content).replace(/\r?\n/g, '<br>')}</p>
            <hr />
            <small>Sent via VAF Portal</small>
          </div>
        `,
      });

      this.logger.log(
        `Bulk email sent successfully to ${recipients.length} recipient(s).`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send bulk email.',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }
}
