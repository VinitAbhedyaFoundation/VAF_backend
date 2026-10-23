import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CompleteDriveDto {
  @ApiPropertyOptional({
    example: 12,
    description:
      'Total waste collected in kilograms. Optional for initiatives that do not track waste.',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(0)
  totalWasteKg?: number;
}