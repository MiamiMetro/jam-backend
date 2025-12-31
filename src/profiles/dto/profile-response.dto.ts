import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({ example: '3450a5e9-2a37-42d8-b12f-f19afc6b06e1' })
  id: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'John Doe' })
  display_name: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg' })
  avatar_url: string;

  @ApiProperty({ example: 'Music producer & DJ' })
  bio: string;

  @ApiProperty({ example: '2024-12-24T19:00:00Z' })
  created_at: string;
}
