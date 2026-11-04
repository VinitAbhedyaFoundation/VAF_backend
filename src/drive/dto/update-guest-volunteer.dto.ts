
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateGuestVolunteerDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Approved volunteer hours',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  hours?: number;

  @ApiPropertyOptional({
    example: 2.5,
    description: 'Collected waste in kilograms; only for Sambhajinagar Ploggers drives',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  waste?: number;
}
