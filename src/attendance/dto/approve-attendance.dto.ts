import { IsInt, Min } from 'class-validator';

export class ApproveAttendanceDto {
  @IsInt()
  @Min(1)
  hours!: number;

  @IsInt()
  @Min(0)
  waste!: number;
}