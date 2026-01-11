import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
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
    const blockCheck = await this.dbService.block.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: recipient_id },
          { blockerId: recipient_id, blockedId: senderId },
        ],
      },
    });

    if (blockCheck) {
      throw new ForbiddenException('Cannot send message to this user');
    }

    // Get recipient profile to check dm_privacy
    const recipientProfile = await this.dbService.profile.findUnique({
      where: { id: recipient_id },
      select: { id: true, dmPrivacy: true },
    });

    if (!recipientProfile) {
      throw new NotFoundException('Recipient not found');
    }

    // Check if users are friends
    const friendship = await this.dbService.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { userId: senderId, friendId: recipient_id },
          { userId: recipient_id, friendId: senderId },
        ],
      },
    });

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
    const newMessage = await this.dbService.message.create({
      data: {
        conversationId: conversationId,
        senderId: senderId,
        text: text || null,
        audioUrl: audio_url || null,
      },
    });

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
    const existing = await this.dbService.conversation.findFirst({
      where: {
        user1: smaller,
        user2: larger,
      },
      select: { id: true },
    });

    if (existing) {
      return existing.id;
    }

    // Yoksa oluştur
    const newConv = await this.dbService.conversation.create({
      data: {
        user1: smaller,
        user2: larger,
      },
      select: { id: true },
    });

    if (!newConv) {
      throw new BadRequestException('Failed to create conversation');
    }

    return newConv.id;
  }

  // Konuşmalarım listesi
  async getMyConversations(userId: string, limit = 50, offset = 0) {
    // Get total count
    const total = await this.dbService.conversation.count({
      where: {
        OR: [{ user1: userId }, { user2: userId }],
      },
    });

    // Benim olduğum tüm conversation'ları al
    const conversationsList = await this.dbService.conversation.findMany({
      where: {
        OR: [{ user1: userId }, { user2: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Her conversation için diğer kullanıcı ve son mesaj bilgilerini al
    const enrichedConversations = await Promise.all(
      conversationsList.map(async (conv) => {
        const otherUserId = conv.user1 === userId ? conv.user2 : conv.user1;

        // Diğer kullanıcının profilini al
        const otherUser = await this.dbService.profile.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        });

        // Son mesajı al
        const lastMessage = await this.dbService.message.findFirst({
          where: { conversationId: conv.id },
          orderBy: { createdAt: 'desc' },
        });

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

    const conversation = await this.dbService.conversation.findFirst({
      where: {
        user1: smaller,
        user2: larger,
      },
      select: { id: true },
    });

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
    const total = await this.dbService.message.count({
      where: { conversationId: conversation.id },
    });

    // Mesajları getir
    const messagesList = await this.dbService.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

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
    const message = await this.dbService.message.findUnique({
      where: { id: messageId },
      select: { senderId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.dbService.message.delete({
      where: { id: messageId },
    });

    return { message: 'Message deleted successfully' };
  }
}
