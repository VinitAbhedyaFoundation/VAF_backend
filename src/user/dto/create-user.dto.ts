import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { BloodGroup, Gender, Occupation } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    enum: BloodGroup,
    enumName: "BloodGroup",
  })
  @IsEnum(BloodGroup)
  @IsNotEmpty()
  bloodGroup!: BloodGroup;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  birthDate!: string;

  @ApiProperty({
    enum: Gender,
    enumName: "Gender",
  })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender!: Gender;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  highestQualification!: string;

  @ApiProperty({
    enum: Occupation,
    enumName: "Occupation",
  })
  @IsEnum(Occupation)
  @IsNotEmpty()
  occupation!: Occupation;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  parentNumber!: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  collegeOrCompany?: string;
}