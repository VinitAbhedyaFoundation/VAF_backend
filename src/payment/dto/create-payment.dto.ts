
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  Max,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: 500,
    description: 'Payment amount in INR',
    minimum: 1,
    maximum: 100000,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must have at most two decimal places' },
  )
  @IsPositive()
  @Min(1)
  @Max(100000)
  amount!: number;
}
