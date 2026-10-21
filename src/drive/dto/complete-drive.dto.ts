import { IsInt, IsNumber, Min } from 'class-validator';

export class CompleteDriveDto {
  @IsInt()
  @IsNumber()
  @Min(0)
  totalWasteKg!: number;
}