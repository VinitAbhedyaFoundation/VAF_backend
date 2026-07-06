import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(
    PaymentService.name,
  );

  private readonly stripe: Stripe;

  constructor() {
    const secretKey =
      process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not configured.',
      );
    }

    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(
    amount: number,
  ): Promise<{ url: string | null }> {
    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new BadRequestException(
        'Invalid payment amount.',
      );
    }

    const frontendUrl =
      process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error(
        'FRONTEND_URL is not configured.',
      );
    }

    try {
      const session =
        await this.stripe.checkout.sessions.create({
          payment_method_types: [
            'card',
          ],
          mode: 'payment',

          line_items: [
            {
              price_data: {
                currency: 'inr',

                product_data: {
                  name: 'Donation',
                },

                unit_amount:
                  Math.round(
                    amount * 100,
                  ),
              },

              quantity: 1,
            },
          ],

          success_url: `${frontendUrl}/payment-success`,

          cancel_url: `${frontendUrl}/payment-cancel`,
        });

      this.logger.log(
        `Checkout session created successfully.`,
      );

      return {
        url: session.url,
      };
    } catch (error) {
      this.logger.error(
        'Stripe checkout session creation failed.',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to create checkout session.',
      );
    }
  }
}