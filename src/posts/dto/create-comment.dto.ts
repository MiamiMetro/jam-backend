import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    example: 'Great track!',
    description: 'Comment text content',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @ApiProperty({
    example: 'https://storage.supabase.co/audio/comment.mp3',
    description: 'Audio file URL (optional, can be null for now)',
    required: false,
  })
  @IsOptional()
  @IsString()
  audio_url?: string;
}
