import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ 
    example: 'johndoe',
    description: 'Unique username (3-20 characters)',
    required: false
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username?: string;

  @ApiProperty({ 
    example: 'John Doe',
    description: 'Display name',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  display_name?: string;

  @ApiProperty({ 
    example: 'https://example.com/avatar.jpg',
    description: 'Avatar URL',
    required: false
  })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiProperty({ 
    example: 'Music producer & DJ',
    description: 'User bio (max 500 characters)',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}