import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator';

export class CreateDriveDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  date!: Date;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  locationId!: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  totalHours!: number;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  expiryDate!: Date;
}