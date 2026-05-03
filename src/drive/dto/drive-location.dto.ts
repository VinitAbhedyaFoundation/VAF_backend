import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateDriveLocationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location!: string; // ✅ FIXED
}