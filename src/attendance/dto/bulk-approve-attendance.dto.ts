import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
} from 'class-validator';

export class BulkApproveAttendanceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  participationIds!: number[];
}