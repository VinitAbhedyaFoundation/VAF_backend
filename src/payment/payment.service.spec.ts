import {
    BadRequestException,
    InternalServerErrorException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';

import { PaymentService } from './payment.service';

jest.mock('stripe', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('PaymentService', () => {
    let service: PaymentService;
    let createSessionMock: jest.Mock;
    let stripeConstructorMock: jest.Mock;

    const originalSecretKey = process.env.STRIPE_SECRET_KEY;
    const originalFrontendUrl = process.env.FRONTEND_URL;

    beforeEach(async () => {
        process.env.STRIPE_SECRET_KEY = 'sk_test_unit_test_key';
        process.env.FRONTEND_URL = 'http://localhost:3000';

        createSessionMock = jest.fn().mockResolvedValue({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.com/test-session',
        });

        stripeConstructorMock = Stripe as unknown as jest.Mock;

        stripeConstructorMock.mockImplementation(() => ({
            checkout: {
                sessions: {
                    create: createSessionMock,
                },
            },
        }));

        const module: TestingModule = await Test.createTestingModule({
            providers: [PaymentService],
        }).compile();

        service = module.get<PaymentService>(PaymentService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        stripeConstructorMock.mockReset();

        if (originalSecretKey === undefined) {
            delete process.env.STRIPE_SECRET_KEY;
        } else {
            process.env.STRIPE_SECRET_KEY = originalSecretKey;
        }

        if (originalFrontendUrl === undefined) {
            delete process.env.FRONTEND_URL;
        } else {
            process.env.FRONTEND_URL = originalFrontendUrl;
        }
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should create a Stripe checkout session', async () => {
        await expect(service.createCheckoutSession(500)).resolves.toEqual({
            url: 'https://checkout.stripe.com/test-session',
        });

        expect(stripeConstructorMock).toHaveBeenCalledWith(
            'sk_test_unit_test_key',
        );

        expect(createSessionMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'payment',
                payment_method_types: ['card'],
                line_items: [
                    expect.objectContaining({
                        price_data: expect.objectContaining({
                            currency: 'inr',
                            product_data: { name: 'Donation' },
                            unit_amount: 50000,
                        }),
                        quantity: 1,
                    }),
                ],
                success_url:
                    'http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: 'http://localhost:3000/payment-cancel',
            }),
        );
    });

    it.each([0, -1, NaN, Infinity, -Infinity, 100001])(
        'should reject invalid amount %s',
        async (amount) => {
            await expect(service.createCheckoutSession(amount)).rejects.toThrow(
                BadRequestException,
            );

            expect(createSessionMock).not.toHaveBeenCalled();
        },
    );

    it('should reject amounts with more than two decimal places', async () => {
        await expect(service.createCheckoutSession(10.123)).rejects.toThrow(
            BadRequestException,
        );

        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('should reject missing Stripe configuration', async () => {
        delete process.env.STRIPE_SECRET_KEY;

        await expect(service.createCheckoutSession(500)).rejects.toThrow(
            ServiceUnavailableException,
        );

        expect(stripeConstructorMock).not.toHaveBeenCalled();
    });

    it('should reject missing frontend URL configuration', async () => {
        delete process.env.FRONTEND_URL;

        await expect(service.createCheckoutSession(500)).rejects.toThrow(
            ServiceUnavailableException,
        );

        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('should reject an invalid frontend URL', async () => {
        process.env.FRONTEND_URL = 'not-a-valid-url';

        await expect(service.createCheckoutSession(500)).rejects.toThrow(
            InternalServerErrorException,
        );

        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('should reject insecure non-local frontend URLs', async () => {
        process.env.FRONTEND_URL = 'http://example.com';

        await expect(service.createCheckoutSession(500)).rejects.toThrow(
            InternalServerErrorException,
        );

        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('should handle Stripe API failures', async () => {
        const loggerErrorSpy = jest
            .spyOn(service['logger'], 'error')
            .mockImplementation(() => undefined);

        createSessionMock.mockRejectedValueOnce(
            new Error('Stripe API unavailable'),
        );

        await expect(service.createCheckoutSession(500)).rejects.toThrow(
            InternalServerErrorException,
        );

        expect(loggerErrorSpy).toHaveBeenCalledWith(
            'Stripe checkout session creation failed.',
            expect.any(String),
        );
    });
});