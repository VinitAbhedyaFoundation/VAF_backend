
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGuestVolunteerDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the drive the guest wants to join',
  })
  @IsInt()
  @Min(1)
  driveId!: number;

  @ApiProperty({
    example: 'Rahul Sharma',
    description: 'Full name of the guest volunteer',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
