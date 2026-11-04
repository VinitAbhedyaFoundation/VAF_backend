import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly bulkBatchSize = 50;

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
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return value.replace(/[&<>"']/g, (char) => entities[char]);
  }

  private validateEmailAddress(email: string): boolean {
    if (email.length > 254) {
      return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private normalizeSubject(subject: string): string {
    if (typeof subject !== 'string' || !subject.trim()) {
      throw new BadRequestException('Email subject cannot be empty.');
    }

    // Prevent header injection and keep subjects readable across mail clients.
    if (/[\r\n]/.test(subject)) {
      throw new BadRequestException(
        'Email subject cannot contain newline characters.',
      );
    }

    const normalized = subject.trim();

    if (normalized.length > 200) {
      throw new BadRequestException(
        'Email subject cannot exceed 200 characters.',
      );
    }

    return normalized;
  }

  private validateContent(content: string): string {
    if (typeof content !== 'string' || !content.trim()) {
      throw new BadRequestException('Email content cannot be empty.');
    }

    return content.trim();
  }

  private normalizeRecipient(email: string): string {
    if (typeof email !== 'string') {
      throw new BadRequestException(
        'A valid recipient email address is required.',
      );
    }

    const normalized = email.trim();

    if (!normalized || !this.validateEmailAddress(normalized)) {
      throw new BadRequestException(
        'A valid recipient email address is required.',
      );
    }

    return normalized;
  }

  private createPlainText(subject: string, content: string): string {
    return `${subject}\n\n${content}\n\nVAF Portal`;
  }

  private createHtmlTemplate(subject: string, content: string): string {
    const safeSubject = this.escapeHtml(subject);
    const safeContent = this.escapeHtml(content).replace(
      /\r?\n/g,
      '<br>',
    );

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#263238;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safeSubject} — VAF Portal
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="background-color:#176b52;padding:24px 28px;color:#ffffff;">
                <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#d8f3e7;">
                  VAF Portal
                </p>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.4;font-weight:700;color:#ffffff;">
                  ${safeSubject}
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:28px;font-size:16px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;">
                ${safeContent}
              </td>
            </tr>

            <tr>
              <td style="padding:18px 28px;background-color:#f8faf9;border-top:1px solid #e5eae7;color:#64746d;font-size:12px;line-height:1.6;">
                This message was sent by VAF Portal.
                <br>
                Please contact the VAF team if you need assistance.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  async sendMail(
    to: string,
    subject: string,
    content: string,
  ): Promise<void> {
    this.ensureEmailConfigured();

    const recipient = this.normalizeRecipient(to);
    const normalizedSubject = this.normalizeSubject(subject);
    const normalizedContent = this.validateContent(content);

    try {
      await this.transporter.sendMail({
        from: `"VAF Portal" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: normalizedSubject,
        text: this.createPlainText(normalizedSubject, normalizedContent),
        html: this.createHtmlTemplate(normalizedSubject, normalizedContent),
      });

      // Do not put personal email addresses in application logs.
      this.logger.log('Email accepted by the SMTP server.');
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

    const recipients = to.map((email) => this.normalizeRecipient(email));
    const uniqueRecipients = [...new Set(recipients)];
    const normalizedSubject = this.normalizeSubject(subject);
    const normalizedContent = this.validateContent(content);

    try {
      // Send sequential BCC batches to avoid oversized recipient lists.
      // A failed later batch can occur after earlier batches were accepted.
      for (
        let index = 0;
        index < uniqueRecipients.length;
        index += this.bulkBatchSize
      ) {
        const batch = uniqueRecipients.slice(
          index,
          index + this.bulkBatchSize,
        );

        await this.transporter.sendMail({
          from: `"VAF Portal" <${process.env.EMAIL_USER}>`,
          bcc: batch,
          subject: normalizedSubject,
          text: this.createPlainText(normalizedSubject, normalizedContent),
          html: this.createHtmlTemplate(normalizedSubject, normalizedContent),
        });
      }

      this.logger.log(
        `Bulk email accepted by the SMTP server for ${uniqueRecipients.length} recipient(s).`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send bulk email. Some earlier batches may already have been accepted.',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }
}
