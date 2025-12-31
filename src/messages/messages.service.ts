import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  messages,
  conversations,
  profiles,
  blocks,
  friends,
} from '../db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
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

    // Get recipient profile to check dm_privacy
    const [recipientProfile] = await this.dbService.db
      .select({ id: profiles.id, dmPrivacy: profiles.dmPrivacy })
      .from(profiles)
      .where(eq(profiles.id, recipient_id))
      .limit(1);

    if (!recipientProfile) {
      throw new NotFoundException('Recipient not found');
    }

    // Check if users are friends
    const [friendship] = await this.dbService.db
      .select()
      .from(friends)
      .where(
        and(
          or(
            and(
              eq(friends.userId, senderId),
              eq(friends.friendId, recipient_id)
            ),
            and(
              eq(friends.userId, recipient_id),
              eq(friends.friendId, senderId)
            )
          ),
          eq(friends.status, 'accepted')
        )
      )
      .limit(1);

    const areFriends = !!friendship;

    // Check if message is allowed: must be friends OR recipient dm_privacy = 'everyone'
    if (!areFriends && recipientProfile.dmPrivacy !== 'everyone') {
      throw new ForbiddenException(
        'You can only send messages to friends or users who allow messages from everyone'
      );
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
  async getMyConversations(userId: string, limit = 50, offset = 0) {
    // Get total count
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        or(eq(conversations.user1, userId), eq(conversations.user2, userId))
      );

    const total = Number(totalResult?.count || 0);

    // Benim olduğum tüm conversation'ları al
    const conversationsList = await this.dbService.db
      .select()
      .from(conversations)
      .where(
        or(eq(conversations.user1, userId), eq(conversations.user2, userId))
      )
      .orderBy(desc(conversations.createdAt))
      .limit(limit)
      .offset(offset);

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
    const sorted = enrichedConversations.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const hasMore = offset + limit < total;

    return {
      data: sorted,
      limit,
      offset,
      total,
      hasMore,
    };
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
      // Henüz conversation yok, boş paginated response döndür
      return {
        data: [],
        limit,
        offset,
        total: 0,
        hasMore: false,
      };
    }

    // Get total count
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id));

    const total = Number(totalResult?.count || 0);

    // Mesajları getir
    const messagesList = await this.dbService.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Eski mesajlar önce (reverse)
    const data = messagesList.reverse().map((msg) => ({
      ...msg,
      conversation_id: msg.conversationId,
      sender_id: msg.senderId,
      audio_url: msg.audioUrl,
      created_at: msg.createdAt,
    }));

    const hasMore = offset + limit < total;

    return {
      data,
      limit,
      offset,
      total,
      hasMore,
    };
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
