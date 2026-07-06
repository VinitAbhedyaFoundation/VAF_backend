import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: 500,
    description: 'Payment amount in INR',
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount!: number;
}