import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe;

  constructor() {
    console.log('STRIPE KEY:', process.env.STRIPE_SECRET_KEY);
    console.log('CLIENT URL:', process.env.CLIENT_URL);

    this.stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY as string,
    );
  }

  async createCheckoutSession(amount: number) {

    console.log('Incoming amount:', amount);

    try {

      const session =
        await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],

          mode: 'payment',

          line_items: [
            {
              price_data: {
                currency: 'inr',

                product_data: {
                  name: 'Donation',
                },

                unit_amount: Math.round(amount * 100),
              },

              quantity: 1,
            },
          ],

          success_url:
            `${process.env.CLIENT_URL}/payment-success`,

          cancel_url:
            `${process.env.CLIENT_URL}/payment-cancel`,
        });

      return {
        url: session.url,
      };

    } catch (error) {

      console.log('STRIPE ERROR:', error);

      throw error;
    }
  }
}