import { IsInt } from 'class-validator';

export class JoinDriveDto {
  @IsInt()
  driveId!: number;
}