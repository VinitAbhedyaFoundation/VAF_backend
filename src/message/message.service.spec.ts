
import {
    BadRequestException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';

describe('MessageService', () => {
    let service: MessageService;

    const mockDb = {
        message: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
        notification: {
            findMany: jest.fn(),
            createMany: jest.fn(),
        },
        user: {
            findMany: jest.fn(),
        },
    };

    const mockMailService = {
        sendBulkMail: jest.fn(),
    };

    const approvedUsers = [
        { id: 1, email: 'first@example.com' },
        { id: 2, email: 'second@example.com' },
    ];

    const dto: CreateMessageDto = {
        subject: 'Upcoming Tree Plantation Drive',
        content: 'Join us this Sunday at 8 AM.',
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockDb.user.findMany.mockResolvedValue(approvedUsers);
        mockMailService.sendBulkMail.mockResolvedValue(undefined);
        mockDb.message.create.mockResolvedValue({
            id: 10,
            subject: dto.subject,
            content: dto.content,
            senderId: 99,
            recipients: 2,
            isBroadcast: true,
        });
        mockDb.notification.createMany.mockResolvedValue({ count: 2 });
        mockDb.message.findMany.mockResolvedValue([]);
        mockDb.notification.findMany.mockResolvedValue([]);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MessageService,
                { provide: DatabaseService, useValue: mockDb },
                { provide: MailService, useValue: mockMailService },
            ],
        }).compile();

        service = module.get<MessageService>(MessageService);
        jest.spyOn(
            (service as any).logger,
            'error',
        ).mockImplementation();
    });

    describe('getAll', () => {
        it('should return messages with sender details, newest first', async () => {
            const messages = [{ id: 1 }, { id: 2 }];
            mockDb.message.findMany.mockResolvedValue(messages);

            await expect(service.getAll()).resolves.toEqual(messages);

            expect(mockDb.message.findMany).toHaveBeenCalledWith({
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should propagate database errors', async () => {
            mockDb.message.findMany.mockRejectedValue(
                new Error('Database failure'),
            );

            await expect(service.getAll()).rejects.toThrow(
                'Database failure',
            );
        });
    });

    describe('getNotifications', () => {
        it('should return notifications for the specified user only', async () => {
            const notifications = [{ id: 1, userId: 7 }];
            mockDb.notification.findMany.mockResolvedValue(notifications);

            await expect(service.getNotifications(7)).resolves.toEqual(
                notifications,
            );

            expect(mockDb.notification.findMany).toHaveBeenCalledWith({
                where: { userId: 7 },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should propagate database errors', async () => {
            mockDb.notification.findMany.mockRejectedValue(
                new Error('Database failure'),
            );

            await expect(service.getNotifications(7)).rejects.toThrow(
                'Database failure',
            );
        });
    });

    describe('send', () => {
        it('should send a broadcast and save the trusted sender ID', async () => {
            await service.send(dto, 99);

            expect(mockDb.user.findMany).toHaveBeenCalledWith({
                where: { status: UserStatus.Approved },
                select: { id: true, email: true },
            });

            expect(mockMailService.sendBulkMail).toHaveBeenCalledWith(
                ['first@example.com', 'second@example.com'],
                dto.subject,
                dto.content,
            );

            expect(mockDb.message.create).toHaveBeenCalledWith({
                data: {
                    subject: dto.subject,
                    content: dto.content,
                    senderId: 99,
                    recipients: 2,
                    isBroadcast: true,
                },
            });

            expect(mockDb.notification.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        userId: 1,
                        title: dto.subject,
                        message: dto.content,
                    },
                    {
                        userId: 2,
                        title: dto.subject,
                        message: dto.content,
                    },
                ],
            });
        });

        it('should return the created message', async () => {
            const createdMessage = { id: 10, senderId: 99 };
            mockDb.message.create.mockResolvedValue(createdMessage);

            await expect(service.send(dto, 99)).resolves.toEqual(
                createdMessage,
            );
        });

        it('should reject an empty subject', async () => {
            await expect(
                service.send({ ...dto, subject: ' ' }, 99),
            ).rejects.toThrow(BadRequestException);

            expect(mockDb.user.findMany).not.toHaveBeenCalled();
        });

        it('should reject empty content', async () => {
            await expect(
                service.send({ ...dto, content: ' ' }, 99),
            ).rejects.toThrow(BadRequestException);

            expect(mockDb.user.findMany).not.toHaveBeenCalled();
        });

        it.each([0, -1, 1.5, NaN])(
            'should reject invalid sender ID: %s',
            async (senderId) => {
                await expect(
                    service.send(dto, senderId),
                ).rejects.toThrow(BadRequestException);

                expect(mockDb.user.findMany).not.toHaveBeenCalled();
            },
        );

        it('should reject when no approved users exist', async () => {
            mockDb.user.findMany.mockResolvedValue([]);

            await expect(
                service.send(dto, 99),
            ).rejects.toThrow(BadRequestException);

            expect(mockMailService.sendBulkMail).not.toHaveBeenCalled();
            expect(mockDb.message.create).not.toHaveBeenCalled();
        });

        it('should reject when approved users have no usable email addresses', async () => {
            mockDb.user.findMany.mockResolvedValue([
                { id: 1, email: null },
                { id: 2, email: '' },
            ]);

            await expect(
                service.send(dto, 99),
            ).rejects.toThrow(BadRequestException);

            expect(mockMailService.sendBulkMail).not.toHaveBeenCalled();
        });

        it('should deduplicate recipient email addresses', async () => {
            mockDb.user.findMany.mockResolvedValue([
                { id: 1, email: 'same@example.com' },
                { id: 2, email: 'same@example.com' },
            ]);

            await service.send(dto, 99);

            expect(mockMailService.sendBulkMail).toHaveBeenCalledWith(
                ['same@example.com'],
                dto.subject,
                dto.content,
            );
        });

        it('should not save a message when email sending fails', async () => {
            mockMailService.sendBulkMail.mockRejectedValue(
                new Error('SMTP failure'),
            );

            await expect(service.send(dto, 99)).rejects.toThrow(
                ServiceUnavailableException,
            );

            expect(mockDb.message.create).not.toHaveBeenCalled();
            expect(mockDb.notification.createMany).not.toHaveBeenCalled();
        });

        it('should preserve an email configuration error', async () => {
            mockMailService.sendBulkMail.mockRejectedValue(
                new ServiceUnavailableException(
                    'Email service is not configured',
                ),
            );

            await expect(service.send(dto, 99)).rejects.toThrow(
                'Email service is not configured',
            );
        });

        it('should propagate message database creation errors', async () => {
            mockDb.message.create.mockRejectedValue(
                new Error('Message database failure'),
            );

            await expect(service.send(dto, 99)).rejects.toThrow(
                'Message database failure',
            );

            expect(mockDb.notification.createMany).not.toHaveBeenCalled();
        });

        it('should propagate notification creation errors', async () => {
            mockDb.notification.createMany.mockRejectedValue(
                new Error('Notification database failure'),
            );

            await expect(service.send(dto, 99)).rejects.toThrow(
                'Notification database failure',
            );
        });
    });
});
