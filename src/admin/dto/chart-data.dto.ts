import { ApiProperty } from '@nestjs/swagger';

export class ChartDataDto {
  @ApiProperty({
    description: 'Day label used for the dashboard chart.',
  })
  name!: string;

  @ApiProperty({
    description: 'Waste collected on the day in kilograms.',
  })
  waste!: number;

  @ApiProperty({
    description: 'Number of approved volunteers on the day.',
  })
  volunteers!: number;
}