import { ApiProperty } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  avatar?: string;
}

export class CommentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  postId: string;

  @ApiProperty({ type: CommentAuthorDto })
  author: CommentAuthorDto;

  @ApiProperty({ example: 'Great track!', required: false })
  content?: string;

  @ApiProperty({
    example: 'https://storage.supabase.co/audio/comment.mp3',
    required: false,
    nullable: true,
  })
  audio_url?: string | null;

  @ApiProperty({ example: '2024-12-26T18:00:00Z' })
  timestamp: string;
}
