
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    example: 'Upcoming Tree Plantation Drive',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  subject!: string;

  @ApiProperty({
    example: 'Join us this Sunday at 8 AM for our tree plantation drive.',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  content!: string;
}
