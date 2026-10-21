import {
    ConflictException,
    InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { NewsletterService } from './newsletter.service';

describe('NewsletterService', () => {
    let service: NewsletterService;

    let databaseService: {
        newsletterSubscriber: {
            findUnique: jest.Mock;
            create: jest.Mock;
            update: jest.Mock;
        };
    };

    let mailService: {
        sendMail: jest.Mock;
    };

    const email = 'subscriber@example.com';
    const dto = { email };

    beforeEach(async () => {
        databaseService = {
            newsletterSubscriber: {
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
        };

        mailService = {
            sendMail: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NewsletterService,
                {
                    provide: DatabaseService,
                    useValue: databaseService,
                },
                {
                    provide: MailService,
                    useValue: mailService,
                },
            ],
        }).compile();

        service = module.get<NewsletterService>(NewsletterService);

        jest.spyOn(service['logger'], 'error').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should create a new subscriber and send a welcome email', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue(null);
        databaseService.newsletterSubscriber.create.mockResolvedValue({
            id: 1,
            email,
            isActive: true,
        });

        await expect(service.subscribe(dto)).resolves.toEqual({
            message: 'Subscribed successfully',
        });

        expect(
            databaseService.newsletterSubscriber.create,
        ).toHaveBeenCalledWith({
            data: { email },
        });

        expect(mailService.sendMail).toHaveBeenCalledWith(
            email,
            'Welcome to VAF Updates!',
            expect.stringContaining('Thank you for subscribing'),
        );
    });

    it('should normalize the email before querying and saving', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue(null);
        databaseService.newsletterSubscriber.create.mockResolvedValue({});

        await service.subscribe({
            email: '  SUBSCRIBER@EXAMPLE.COM  ',
        });

        expect(
            databaseService.newsletterSubscriber.findUnique,
        ).toHaveBeenCalledWith({
            where: { email },
        });

        expect(
            databaseService.newsletterSubscriber.create,
        ).toHaveBeenCalledWith({
            data: { email },
        });
    });

    it('should reject an already active subscriber', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue({
            id: 1,
            email,
            isActive: true,
        });

        await expect(service.subscribe(dto)).rejects.toThrow(
            ConflictException,
        );

        expect(
            databaseService.newsletterSubscriber.create,
        ).not.toHaveBeenCalled();

        expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('should reactivate an inactive subscriber and send a welcome-back email', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue({
            id: 1,
            email,
            isActive: false,
        });

        databaseService.newsletterSubscriber.update.mockResolvedValue({
            id: 1,
            email,
            isActive: true,
        });

        await expect(service.subscribe(dto)).resolves.toEqual({
            message: 'Newsletter subscription reactivated successfully',
        });

        expect(
            databaseService.newsletterSubscriber.update,
        ).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { isActive: true },
        });

        expect(mailService.sendMail).toHaveBeenCalledWith(
            email,
            'Welcome back to VAF Updates!',
            expect.stringContaining('subscription has been reactivated'),
        );
    });

    it('should return ConflictException if concurrent creation causes Prisma P2002', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue(null);

        databaseService.newsletterSubscriber.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError(
                'Unique constraint failed',
                {
                    code: 'P2002',
                    clientVersion: '5.22.0',
                    meta: { target: ['email'] },
                },
            ),
        );

        await expect(service.subscribe(dto)).rejects.toThrow(
            ConflictException,
        );

        expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('should keep the subscription successful if the welcome email fails', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue(null);
        databaseService.newsletterSubscriber.create.mockResolvedValue({});

        mailService.sendMail.mockRejectedValue(new Error('SMTP unavailable'));

        await expect(service.subscribe(dto)).resolves.toEqual({
            message: 'Subscribed successfully',
        });

        expect(
            databaseService.newsletterSubscriber.create,
        ).toHaveBeenCalled();
    });

    it('should keep reactivation successful if the confirmation email fails', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue({
            id: 1,
            email,
            isActive: false,
        });

        databaseService.newsletterSubscriber.update.mockResolvedValue({});
        mailService.sendMail.mockRejectedValue(new Error('SMTP unavailable'));

        await expect(service.subscribe(dto)).resolves.toEqual({
            message: 'Newsletter subscription reactivated successfully',
        });

        expect(
            databaseService.newsletterSubscriber.update,
        ).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if the initial database lookup fails', async () => {
        databaseService.newsletterSubscriber.findUnique.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(service.subscribe(dto)).rejects.toThrow(
            InternalServerErrorException,
        );
    });

    it('should throw InternalServerErrorException if creating a subscriber fails', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue(null);
        databaseService.newsletterSubscriber.create.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(service.subscribe(dto)).rejects.toThrow(
            InternalServerErrorException,
        );
    });

    it('should throw InternalServerErrorException if reactivation fails', async () => {
        databaseService.newsletterSubscriber.findUnique.mockResolvedValue({
            id: 1,
            email,
            isActive: false,
        });

        databaseService.newsletterSubscriber.update.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(service.subscribe(dto)).rejects.toThrow(
            InternalServerErrorException,
        );
    });
});