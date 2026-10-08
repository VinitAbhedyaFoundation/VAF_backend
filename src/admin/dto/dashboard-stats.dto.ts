import { ApiProperty } from '@nestjs/swagger';

import { ChartDataDto } from './chart-data.dto';
import { LeaderboardEntryDto } from './leaderboard-entry.dto';

export class DashboardStatsDto {
  @ApiProperty({
    description: 'Total number of volunteers.',
  })
  totalVolunteers!: number;

  @ApiProperty({
    description: 'Total number of drives.',
  })
  totalDrives!: number;

  @ApiProperty({
    description: 'Total number of approved volunteer hours.',
  })
  totalHours!: number;

  @ApiProperty({
    description: 'Total waste collected in kilograms.',
  })
  wasteCollected!: number;

  @ApiProperty({
    description: 'Daily statistics for the dashboard chart.',
    type: [ChartDataDto],
  })
  chartData!: ChartDataDto[];

  @ApiProperty({
    description: 'Top volunteers ranked by collected waste and drives.',
    type: [LeaderboardEntryDto],
  })
  leaderboard!: LeaderboardEntryDto[];
}