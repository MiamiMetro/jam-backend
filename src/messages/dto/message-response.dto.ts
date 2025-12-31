import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'b1c2d3e4-f5g6-7890-hijk-lmnopqrstuvw' })
  conversation_id: string;

  @ApiProperty({ example: '3450a5e9-2a37-4208-b12f-f19afc6b06e1' })
  sender_id: string;

  @ApiProperty({ example: 'Hey! How are you?' })
  text: string;

  @ApiProperty({ example: 'https://storage.supabase.co/audio/voice.mp3' })
  audio_url: string;

  @ApiProperty({ example: '2024-12-26T18:00:00Z' })
  created_at: string;
}

export class ConversationUserDto {
  @ApiProperty({ example: '3450a5e9-2a37-4208-b12f-f19afc6b06e1' })
  id: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'John Doe' })
  display_name: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg' })
  avatar_url: string;
}

export class ConversationResponseDto {
  @ApiProperty({ example: 'b1c2d3e4-f5g6-7890-hijk-lmnopqrstuvw' })
  id: string;

  @ApiProperty({ type: ConversationUserDto })
  other_user: ConversationUserDto;

  @ApiProperty({ type: MessageResponseDto })
  last_message: MessageResponseDto;

  @ApiProperty({ example: '2024-12-26T18:00:00Z' })
  updated_at: string;
}
