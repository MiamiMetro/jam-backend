import { ApiProperty } from '@nestjs/swagger';

export class BlockResponseDto {
  @ApiProperty({ example: '3450a5e9-2a37-4208-b12f-f19afc6b06e1' })
  blocker_id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  blocked_id: string;

  @ApiProperty({ example: '2024-12-25T18:00:00Z' })
  created_at: string;
}

export class BlockedUserDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'blockeduser' })
  username: string;

  @ApiProperty({ example: 'Blocked User' })
  display_name: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg' })
  avatar_url: string;
}
