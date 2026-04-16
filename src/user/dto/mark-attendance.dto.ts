import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class MarkAttendanceDto {
  @ApiProperty({ example: "TEMP12345" })
  @IsString()
  @IsNotEmpty()
  temporaryToken: string;
}