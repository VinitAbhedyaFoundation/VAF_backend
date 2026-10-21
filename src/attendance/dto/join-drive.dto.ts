import { IsInt, Min } from 'class-validator';

export class JoinDriveDto {
  @IsInt()
  @Min(1)
  driveId!: number;
}