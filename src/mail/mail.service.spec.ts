
import {
    BadRequestException,
    ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
    createTransport: jest.fn(),
}));

describe('MailService', () => {
    const originalEmailUser = process.env.EMAIL_USER;
    const originalEmailPass = process.env.EMAIL_PASS;

    const mockTransporter = {
        verify: jest.fn(),
        sendMail: jest.fn(),
    };

    let service: MailService;

    const createService = (): MailService => {
        (nodemailer.createTransport as jest.Mock).mockReturnValue(
            mockTransporter,
        );

        const instance = new MailService();

        // Keep expected log output out of test results.
        jest.spyOn((instance as any).logger, 'log').mockImplementation();
        jest.spyOn((instance as any).logger, 'warn').mockImplementation();
        jest.spyOn((instance as any).logger, 'error').mockImplementation();

        return instance;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        process.env.EMAIL_USER = 'vaf-test@gmail.com';
        process.env.EMAIL_PASS = 'test-app-password';

        mockTransporter.verify.mockResolvedValue(true);
        mockTransporter.sendMail.mockResolvedValue({
            messageId: 'test-message-id',
        });

        service = createService();
    });

    afterAll(() => {
        if (originalEmailUser === undefined) {
            delete process.env.EMAIL_USER;
        } else {
            process.env.EMAIL_USER = originalEmailUser;
        }

        if (originalEmailPass === undefined) {
            delete process.env.EMAIL_PASS;
        } else {
            process.env.EMAIL_PASS = originalEmailPass;
        }
    });

    describe('initialization', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should verify the mail server when credentials exist', async () => {
            await service.onModuleInit();

            expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
        });

        it('should start without credentials', async () => {
            delete process.env.EMAIL_USER;
            delete process.env.EMAIL_PASS;

            const instance = createService();

            await expect(instance.onModuleInit()).resolves.toBeUndefined();
            expect(mockTransporter.verify).not.toHaveBeenCalled();
        });

        it('should not crash if mail server verification fails', async () => {
            mockTransporter.verify.mockRejectedValue(
                new Error('SMTP unavailable'),
            );

            await expect(service.onModuleInit()).resolves.toBeUndefined();
        });
    });

    describe('sendMail', () => {
        it('should send an email to a valid recipient', async () => {
            await service.sendMail(
                'recipient@example.com',
                'Test subject',
                'Test content',
            );

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'recipient@example.com',
                    subject: 'Test subject',
                    from: '"VAF Portal" <vaf-test@gmail.com>',
                }),
            );
        });

        it('should escape HTML in the subject and content', async () => {
            await service.sendMail(
                'recipient@example.com',
                '<script>alert(1)</script>',
                '<img src=x onerror=alert(1)>',
            );

            const options = mockTransporter.sendMail.mock.calls[0][0];

            expect(options.html).not.toContain('<script>');
            expect(options.html).toContain('&lt;script&gt;');
            expect(options.html).toContain('&lt;img');
        });

        it('should reject an invalid recipient', async () => {
            await expect(
                service.sendMail('invalid-email', 'Subject', 'Content'),
            ).rejects.toThrow(BadRequestException);

            expect(mockTransporter.sendMail).not.toHaveBeenCalled();
        });

        it('should reject an empty subject', async () => {
            await expect(
                service.sendMail('recipient@example.com', '  ', 'Content'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject empty content', async () => {
            await expect(
                service.sendMail('recipient@example.com', 'Subject', '  '),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject sending when credentials are missing', async () => {
            delete process.env.EMAIL_USER;

            await expect(
                service.sendMail(
                    'recipient@example.com',
                    'Subject',
                    'Content',
                ),
            ).rejects.toThrow(ServiceUnavailableException);

            expect(mockTransporter.sendMail).not.toHaveBeenCalled();
        });

        it('should rethrow errors when sending fails', async () => {
            const error = new Error('SMTP send failed');
            mockTransporter.sendMail.mockRejectedValue(error);

            await expect(
                service.sendMail(
                    'recipient@example.com',
                    'Subject',
                    'Content',
                ),
            ).rejects.toThrow('SMTP send failed');
        });
    });

    describe('sendBulkMail', () => {
        it('should send bulk email using BCC', async () => {
            const recipients = [
                'first@example.com',
                'second@example.com',
            ];

            await service.sendBulkMail(
                recipients,
                'Bulk announcement',
                'Announcement content',
            );

            expect(mockTransporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    bcc: recipients,
                    subject: 'Bulk announcement',
                    from: '"VAF Portal" <vaf-test@gmail.com>',
                }),
            );
        });

        it('should reject an empty recipient list', async () => {
            await expect(
                service.sendBulkMail([], 'Subject', 'Content'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject invalid bulk recipients', async () => {
            await expect(
                service.sendBulkMail(
                    ['first@example.com', 'invalid-email'],
                    'Subject',
                    'Content',
                ),
            ).rejects.toThrow(BadRequestException);

            expect(mockTransporter.sendMail).not.toHaveBeenCalled();
        });

        it('should reject bulk sending when credentials are missing', async () => {
            delete process.env.EMAIL_PASS;

            await expect(
                service.sendBulkMail(
                    ['recipient@example.com'],
                    'Subject',
                    'Content',
                ),
            ).rejects.toThrow(ServiceUnavailableException);

            expect(mockTransporter.sendMail).not.toHaveBeenCalled();
        });

        it('should reject an empty bulk email subject', async () => {
            await expect(
                service.sendBulkMail(
                    ['recipient@example.com'],
                    '',
                    'Content',
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should rethrow errors when bulk sending fails', async () => {
            mockTransporter.sendMail.mockRejectedValue(
                new Error('Bulk SMTP failure'),
            );

            await expect(
                service.sendBulkMail(
                    ['recipient@example.com'],
                    'Subject',
                    'Content',
                ),
            ).rejects.toThrow('Bulk SMTP failure');
        });
    });
});
