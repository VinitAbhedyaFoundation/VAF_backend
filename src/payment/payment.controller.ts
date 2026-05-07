import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
  ) {}

  @Post('checkout')
  async checkout(
    @Body() body: any,
  ) {

    console.log(body);

    return this.paymentService.createCheckoutSession(
      Number(body.amount),
    );
  }
}