
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  private stripe?: Stripe;

  private getStripe(): Stripe {
    if (this.stripe) {
      return this.stripe;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (!secretKey) {
      throw new ServiceUnavailableException(
        'Payment service is not configured.',
      );
    }

    this.stripe = new Stripe(secretKey);
    return this.stripe;
  }

  async createCheckoutSession(
    amount: number,
  ): Promise<{ url: string | null }> {
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount < 1 ||
      amount > 100000
    ) {
      throw new BadRequestException(
        'Amount must be between INR 1 and INR 100000.',
      );
    }

    const amountInPaise = Math.round(amount * 100);

    if (
      Math.abs(amount * 100 - amountInPaise) > 1e-7
    ) {
      throw new BadRequestException(
        'Amount must have at most two decimal places.',
      );
    }

    const frontendUrl = process.env.FRONTEND_URL?.trim();

    if (!frontendUrl) {
      throw new ServiceUnavailableException(
        'Payment redirect URLs are not configured.',
      );
    }

    let parsedFrontendUrl: URL;

    try {
      parsedFrontendUrl = new URL(frontendUrl);
    } catch {
      throw new InternalServerErrorException(
        'Payment redirect URL configuration is invalid.',
      );
    }

    if (
      !['http:', 'https:'].includes(parsedFrontendUrl.protocol) ||
      parsedFrontendUrl.username ||
      parsedFrontendUrl.password ||
      parsedFrontendUrl.pathname !== '/' ||
      parsedFrontendUrl.search ||
      parsedFrontendUrl.hash
    ) {
      throw new InternalServerErrorException(
        'Payment redirect URL configuration is invalid.',
      );
    }

    if (
      parsedFrontendUrl.protocol !== 'https:' &&
      parsedFrontendUrl.hostname !== 'localhost' &&
      parsedFrontendUrl.hostname !== '127.0.0.1'
    ) {
      throw new InternalServerErrorException(
        'HTTPS is required for the frontend URL outside localhost.',
      );
    }

    try {
      const stripe = this.getStripe();

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'inr',
              product_data: {
                name: 'Donation',
              },
              unit_amount: amountInPaise,
            },
            quantity: 1,
          },
        ],
        success_url:
          `${parsedFrontendUrl.origin}/payment-success` +
          '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: `${parsedFrontendUrl.origin}/payment-cancel`,
      });

      this.logger.log('Stripe Checkout Session created.');

      return { url: session.url };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error(
        'Stripe checkout session creation failed.',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to create checkout session.',
      );
    }
  }
}
