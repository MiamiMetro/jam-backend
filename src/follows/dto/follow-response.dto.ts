import { ApiProperty } from '@nestjs/swagger';

export class FollowResponseDto {
  @ApiProperty({ example: '3450a5e9-2a37-4208-b12f-f19afc6b06e1' })
  follower_id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  following_id: string;

  @ApiProperty({ example: '2024-12-26T18:00:00Z' })
  created_at: string;
}

export class FollowUserDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'John Doe' })
  display_name: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg' })
  avatar_url: string;

  @ApiProperty({ example: 'Music producer' })
  bio: string;
}