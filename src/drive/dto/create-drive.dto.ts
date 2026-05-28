import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDriveDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  date!: Date;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  totalHours!: number;

}