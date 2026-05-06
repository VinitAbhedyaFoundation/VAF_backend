import { IsDateString, IsInt } from "class-validator";

export class CreateDriveDto {
  @IsDateString()
  date!: string;

  @IsInt()
  locationId!: number;

  @IsInt()
  totalHours!: number;

  @IsDateString()
  expiryDate!: string;
}