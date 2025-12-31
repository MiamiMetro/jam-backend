import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { messages, conversations, profiles, blocks } from '../db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(private dbService: DbService) {}

  // Mesaj gönder
  async sendMessage(senderId: string, sendMessageDto: SendMessageDto) {
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
    const [blockCheck] = await this.dbService.db
      .select()
      .from(blocks)
      .where(
        or(
          and(
            eq(blocks.blockerId, senderId),
            eq(blocks.blockedId, recipient_id)
          ),
          and(
            eq(blocks.blockerId, recipient_id),
            eq(blocks.blockedId, senderId)
          )
        )
      )
      .limit(1);

    if (blockCheck) {
      throw new ForbiddenException('Cannot send message to this user');
    }

    // Conversation bul veya oluştur
    const conversationId = await this.findOrCreateConversation(
      senderId,
      recipient_id
    );

    // Mesajı kaydet
    const [newMessage] = await this.dbService.db
      .insert(messages)
      .values({
        conversationId: conversationId,
        senderId: senderId,
        text: text || null,
        audioUrl: audio_url || null,
      })
      .returning();

    if (!newMessage) {
      throw new BadRequestException('Failed to send message');
    }

    return newMessage;
  }

  // Conversation bul veya oluştur (helper)
  private async findOrCreateConversation(
    user1: string,
    user2: string
  ): Promise<string> {
    // user_1 her zaman küçük ID olmalı (database constraint)
    const [smaller, larger] = [user1, user2].sort();

    // Mevcut conversation'ı bul
    const [existing] = await this.dbService.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(eq(conversations.user1, smaller), eq(conversations.user2, larger))
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }

    // Yoksa oluştur
    const [newConv] = await this.dbService.db
      .insert(conversations)
      .values({
        user1: smaller,
        user2: larger,
      })
      .returning({ id: conversations.id });

    if (!newConv) {
      throw new BadRequestException('Failed to create conversation');
    }

    return newConv.id;
  }

  // Konuşmalarım listesi
  async getMyConversations(userId: string) {
    // Benim olduğum tüm conversation'ları al
    const conversationsList = await this.dbService.db
      .select()
      .from(conversations)
      .where(
        or(eq(conversations.user1, userId), eq(conversations.user2, userId))
      )
      .orderBy(desc(conversations.createdAt));

    // Her conversation için diğer kullanıcı ve son mesaj bilgilerini al
    const enrichedConversations = await Promise.all(
      conversationsList.map(async (conv) => {
        const otherUserId = conv.user1 === userId ? conv.user2 : conv.user1;

        // Diğer kullanıcının profilini al
        const [otherUser] = await this.dbService.db
          .select({
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
          })
          .from(profiles)
          .where(eq(profiles.id, otherUserId))
          .limit(1);

        // Son mesajı al
        const [lastMessage] = await this.dbService.db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        return {
          id: conv.id,
          other_user: otherUser
            ? {
                ...otherUser,
                display_name: otherUser.displayName,
                avatar_url: otherUser.avatarUrl,
              }
            : null,
          last_message: lastMessage
            ? {
                ...lastMessage,
                conversation_id: lastMessage.conversationId,
                sender_id: lastMessage.senderId,
                audio_url: lastMessage.audioUrl,
                created_at: lastMessage.createdAt,
              }
            : null,
          updated_at: lastMessage?.createdAt || conv.createdAt,
        };
      })
    );

    // Son mesaja göre sırala
    return enrichedConversations.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  // Belirli bir kullanıcıyla mesajlar
  async getMessagesWithUser(
    userId: string,
    otherUserId: string,
    limit = 50,
    offset = 0
  ) {
    // Conversation'ı bul
    const [smaller, larger] = [userId, otherUserId].sort();

    const [conversation] = await this.dbService.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(eq(conversations.user1, smaller), eq(conversations.user2, larger))
      )
      .limit(1);

    if (!conversation) {
      // Henüz conversation yok, boş array döndür
      return [];
    }

    // Mesajları getir
    const messagesList = await this.dbService.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Eski mesajlar önce (reverse)
    return messagesList.reverse().map((msg) => ({
      ...msg,
      conversation_id: msg.conversationId,
      sender_id: msg.senderId,
      audio_url: msg.audioUrl,
      created_at: msg.createdAt,
    }));
  }

  // Mesaj sil (sadece kendi mesajını)
  async deleteMessage(messageId: string, userId: string) {
    // Mesajın sahibi mi kontrol et
    const [message] = await this.dbService.db
      .select({ senderId: messages.senderId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.dbService.db.delete(messages).where(eq(messages.id, messageId));

    return { message: 'Message deleted successfully' };
  }
}
