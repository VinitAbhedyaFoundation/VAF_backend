import { IsNumber, Min } from 'class-validator';

export class CompleteDriveDto {
  @IsNumber()
  @Min(0)
  totalWasteKg!: number;
}