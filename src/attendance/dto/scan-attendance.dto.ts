import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ScanAttendanceDto {
  @ApiProperty({
    example: 25,
    description: 'Participation ID from QR code',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
participationId!: number;
}