import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(private supabaseService: SupabaseService) {}

  // Mesaj gönder
  async sendMessage(senderId: string, sendMessageDto: SendMessageDto) {
    const supabase = this.supabaseService.getClient();

    const { recipient_id, text, audio_url } = sendMessageDto;

    // Kendine mesaj gönderemez
    if (senderId === recipient_id) {
      throw new BadRequestException('You cannot send message to yourself');
    }

    // Text veya audio en az biri olmalı
    if (!text && !audio_url) {
      throw new BadRequestException('Message must have either text or audio');
    }

    // Block kontrolü (engelleme varsa mesaj gönderemez)
    const { data: blockCheck } = await supabase
      .from('blocks')
      .select('*')
      .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${recipient_id}),and(blocker_id.eq.${recipient_id},blocked_id.eq.${senderId})`)
      .single();

    if (blockCheck) {
      throw new ForbiddenException('Cannot send message to this user');
    }

    // Conversation bul veya oluştur
    const conversationId = await this.findOrCreateConversation(senderId, recipient_id);

    // Mesajı kaydet
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        text: text,
        audio_url: audio_url,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to send message');
    }

    return message;
  }

  // Conversation bul veya oluştur (helper)
  private async findOrCreateConversation(user1: string, user2: string): Promise<string> {
    const supabase = this.supabaseService.getClient();

    // user_1 her zaman küçük ID olmalı (database constraint)
    const [smaller, larger] = [user1, user2].sort();

    // Mevcut conversation'ı bul
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_1', smaller)
      .eq('user_2', larger)
      .single();

    if (existing) {
      return existing.id;
    }

    // Yoksa oluştur
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        user_1: smaller,
        user_2: larger,
      })
      .select('id')
      .single();

    if (error) {
      throw new BadRequestException('Failed to create conversation');
    }

    return newConv.id;
  }

  // Konuşmalarım listesi
  async getMyConversations(userId: string) {
    const supabase = this.supabaseService.getClient();

    // Benim olduğum tüm conversation'ları al
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_1.eq.${userId},user_2.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to fetch conversations');
    }

    // Her conversation için diğer kullanıcı ve son mesaj bilgilerini al
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.user_1 === userId ? conv.user_2 : conv.user_1;

        // Diğer kullanıcının profilini al
        const { data: otherUser } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .eq('id', otherUserId)
          .single();

        // Son mesajı al
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          id: conv.id,
          other_user: otherUser,
          last_message: lastMessage,
          updated_at: lastMessage?.created_at || conv.created_at,
        };
      })
    );

    // Son mesaja göre sırala
    return enrichedConversations.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  // Belirli bir kullanıcıyla mesajlar
  async getMessagesWithUser(userId: string, otherUserId: string, limit = 50, offset = 0) {
    const supabase = this.supabaseService.getClient();

    // Conversation'ı bul
    const [smaller, larger] = [userId, otherUserId].sort();

    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_1', smaller)
      .eq('user_2', larger)
      .single();

    if (!conversation) {
      // Henüz conversation yok, boş array döndür
      return [];
    }

    // Mesajları getir
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new BadRequestException('Failed to fetch messages');
    }

    return messages.reverse(); // Eski mesajlar önce
  }

  // Mesaj sil (sadece kendi mesajını)
  async deleteMessage(messageId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Mesajın sahibi mi kontrol et
    const { data: message } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.sender_id !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      throw new BadRequestException('Failed to delete message');
    }

    return { message: 'Message deleted successfully' };
  }
}