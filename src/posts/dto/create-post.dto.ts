import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    example: 'Just finished my new track! 🎵',
    description: 'Post text content',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;

  @ApiProperty({
    example: 'https://storage.supabase.co/audio/track.mp3',
    description: 'Audio file URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  audio_url?: string;
}
