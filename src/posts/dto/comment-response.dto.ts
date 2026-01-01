import { ApiProperty } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({ example: '3450a5e9-2a37-4208-b12f-f19afc6b06e1' })
  id: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'John Doe' })
  display_name: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg' })
  avatar_url: string;
}

export class CommentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: '3450a5e9-2a37-4208-b12f-f19afc6b06e1' })
  author_id: string;

  @ApiProperty({ type: CommentAuthorDto })
  author: CommentAuthorDto;

  @ApiProperty({ example: 'Great track!' })
  text: string;

  @ApiProperty({ example: 'https://storage.supabase.co/audio/comment.mp3' })
  audio_url: string;

  @ApiProperty({ example: '2024-12-26T18:00:00Z' })
  created_at: string;

  @ApiProperty({ example: 5 })
  likes_count: number;

  @ApiProperty({ example: false })
  is_liked: boolean;
}
