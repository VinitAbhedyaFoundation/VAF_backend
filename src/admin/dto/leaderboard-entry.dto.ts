import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({
    description: 'Volunteer name.',
  })
  name!: string;

  @ApiProperty({
    description: 'Waste attributed to the volunteer in kilograms.',
  })
  kg!: number;

  @ApiProperty({
    description: 'Number of approved drives completed by the volunteer.',
  })
  drives!: number;

  @ApiProperty({
    description: 'Leaderboard rank.',
  })
  rank!: number;
}