import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class BlocksService {
  constructor(private dbService: DbService) {}

  // Kullanıcıyı engelle
  async blockUser(blockerId: string, blockedId: string) {
    // Kendini engelleyemez
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    // Zaten engellenmiş mi kontrol et
    const existingBlock = await this.dbService.block.findFirst({
      where: {
        blockerId,
        blockedId,
      },
    });

    if (existingBlock) {
      throw new BadRequestException('User already blocked');
    }

    // Engelle
    const newBlock = await this.dbService.block.create({
      data: {
        blockerId,
        blockedId,
      },
    });

    if (!newBlock) {
      throw new BadRequestException('Failed to block user');
    }

    return newBlock;
  }

  // Engeli kaldır
  async unblockUser(blockerId: string, blockedId: string) {
    const deleted = await this.dbService.block.deleteMany({
      where: {
        blockerId,
        blockedId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Block not found');
    }

    return { message: 'User unblocked successfully' };
  }

  // Engellediklerim listesi
  async getBlockedUsers(blockerId: string, limit = 50, offset = 0) {
    // Get total count
    const total = await this.dbService.block.count({
      where: { blockerId },
    });

    const blockedList = await this.dbService.block.findMany({
      where: { blockerId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      take: limit,
      skip: offset,
    });

    // Profil bilgilerini düzenle
    const data = blockedList.map((block) => ({
      id: block.blocked.id,
      username: block.blocked.username,
      display_name: block.blocked.displayName || '',
      avatar_url: block.blocked.avatarUrl || '',
      blocked_at: block.createdAt,
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

  // İki kullanıcı arasında engel var mı kontrol et (helper fonksiyon)
  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block = await this.dbService.block.findFirst({
      where: {
        OR: [
          { blockerId: userId1, blockedId: userId2 },
          { blockerId: userId2, blockedId: userId1 },
        ],
      },
    });

    return !!block;
  }
}
