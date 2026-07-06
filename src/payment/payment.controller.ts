import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
  ) {}

  @Post('checkout')
  @ApiOperation({
    summary: 'Create Stripe checkout session',
  })
  async checkout(
    @Body()
    body: CreatePaymentDto,
  ) {
    return this.paymentService.createCheckoutSession(
      body.amount,
    );
  }
}