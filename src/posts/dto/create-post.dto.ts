import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    example: 'Just finished my new track! 🎵',
    description: 'Post text content',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;

  @ApiProperty({
    example: 'https://storage.supabase.co/audio/track.mp3',
    description: 'Audio file URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  audio_url?: string;

  @ApiProperty({
    example: 'public',
    description: 'Post visibility',
    enum: ['public', 'followers'],
    default: 'public',
  })
  @IsOptional()
  @IsIn(['public', 'followers'])
  visibility?: string;
}
