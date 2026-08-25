import { IsInt } from 'class-validator';

export class MarkAttendanceDto {
  @IsInt()
  driveId!: number;
}