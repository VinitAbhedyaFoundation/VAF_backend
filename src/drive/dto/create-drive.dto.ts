import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Initiative } from '@prisma/client';

export class CreateDriveDto {
  @ApiProperty({
    example: 'Community Awareness Drive',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({
    enum: Initiative,
    example: Initiative.LAAL_BINDI,
    description: 'The foundation initiative organizing this drive',
  })
  @IsEnum(Initiative)
  @IsNotEmpty()
  initiative!: Initiative;

  @ApiPropertyOptional({
    example: 'An awareness session for the local community.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: 'Chhatrapati Sambhajinagar',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  location!: string;

  @ApiProperty({
    example: '2026-11-10T08:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  date!: Date;

  @ApiProperty({
    example: 4,
    description: 'Planned volunteering hours',
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  totalHours!: number;
}