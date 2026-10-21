
import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create Stripe checkout session',
  })
  @ApiResponse({
    status: 201,
    description: 'Checkout session created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment amount.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async checkout(@Body() body: CreatePaymentDto) {
    return this.paymentService.createCheckoutSession(
      body.amount,
    );
  }
}
