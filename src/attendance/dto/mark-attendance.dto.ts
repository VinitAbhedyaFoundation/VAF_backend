import { IsInt, Min } from 'class-validator';

export class MarkAttendanceDto {
  @IsInt()
  @Min(1)
  driveId!: number;
}