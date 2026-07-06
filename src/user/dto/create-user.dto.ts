import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  BloodGroup,
  Gender,
  Occupation,
} from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value.trim())
  name!: string;

  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value.toLowerCase().trim())
  email!: string;

  @ApiProperty({
    example: 'StrongPass123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message:
      'Password must contain letters and numbers',
  })
  password!: string;

  @ApiProperty({
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Invalid phone number',
  })
  phone!: string;

  @ApiProperty({
    enum: BloodGroup,
    enumName: 'BloodGroup',
  })
  @IsEnum(BloodGroup)
  @IsNotEmpty()
  bloodGroup!: BloodGroup;

  @ApiProperty({
    example: '2000-01-15',
  })
  @IsDateString()
  @IsNotEmpty()
  birthDate!: string;

  @ApiProperty({
    enum: Gender,
    enumName: 'Gender',
  })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender!: Gender;

  @ApiProperty({
    example: 'Bachelor of Computer Science',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(({ value }) => value.trim())
  highestQualification!: string;

  @ApiProperty({
    enum: Occupation,
    enumName: 'Occupation',
  })
  @IsEnum(Occupation)
  @IsNotEmpty()
  occupation!: Occupation;

  @ApiProperty({
    example: 'Pune, Maharashtra',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value.trim())
  address!: string;

  @ApiProperty({
    example: 'Pune',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  city?: string;

  @ApiProperty({
    example: 'Maharashtra',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  state?: string;

  @ApiProperty({
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Invalid parent phone number',
  })
  parentNumber!: string;

  @ApiProperty({
    example: 'PES Modern College',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => value?.trim())
  collegeOrCompany?: string;
}