import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID of user to send message to',
  })
  @IsNotEmpty()
  @IsUUID()
  recipient_id: string;

  @ApiProperty({
    example: 'Hey! How are you?',
    description: 'Message text',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;

  @ApiProperty({
    example: 'https://storage.supabase.co/audio/voice.mp3',
    description: 'Audio message URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  audio_url?: string;
}
