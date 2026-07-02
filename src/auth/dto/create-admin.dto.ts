import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { Transform } from "class-transformer";

export class CreateAdminDto {
  @ApiProperty({ example: "Admin Name" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value.trim())
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: "Name must contain only letters",
  })
  name!: string;

  @ApiProperty({ example: "admin@gmail.com" })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: "StrongPass123" })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "Password must contain letters and numbers",
  })
  password!: string;
}