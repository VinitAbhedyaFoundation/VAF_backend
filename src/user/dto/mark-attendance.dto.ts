import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class MarkAttendanceDto {
  @ApiProperty({
    example: 'TEMP12345',
    description: 'Temporary attendance token generated for the drive',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(100)
  @Transform(({ value }) => value.trim())
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Invalid attendance token format',
  })
  temporaryToken!: string;
}