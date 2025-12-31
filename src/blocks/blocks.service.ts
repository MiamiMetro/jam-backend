import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { blocks, profiles } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';

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
    const [existingBlock] = await this.dbService.db
      .select()
      .from(blocks)
      .where(
        and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId))
      )
      .limit(1);

    if (existingBlock) {
      throw new BadRequestException('User already blocked');
    }

    // Engelle
    const [newBlock] = await this.dbService.db
      .insert(blocks)
      .values({
        blockerId: blockerId,
        blockedId: blockedId,
      })
      .returning();

    if (!newBlock) {
      throw new BadRequestException('Failed to block user');
    }

    return newBlock;
  }

  // Engeli kaldır
  async unblockUser(blockerId: string, blockedId: string) {
    const [deleted] = await this.dbService.db
      .delete(blocks)
      .where(
        and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId))
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException('Block not found');
    }

    return { message: 'User unblocked successfully' };
  }

  // Engellediklerim listesi
  async getBlockedUsers(blockerId: string) {
    const blockedList = await this.dbService.db
      .select({
        blockedId: blocks.blockedId,
        createdAt: blocks.createdAt,
        profile: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(blocks)
      .innerJoin(profiles, eq(blocks.blockedId, profiles.id))
      .where(eq(blocks.blockerId, blockerId));

    // Profil bilgilerini düzenle
    return blockedList.map((block) => ({
      ...block.profile,
      display_name: block.profile.displayName,
      avatar_url: block.profile.avatarUrl,
      blocked_at: block.createdAt,
    }));
  }

  // İki kullanıcı arasında engel var mı kontrol et (helper fonksiyon)
  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const [block] = await this.dbService.db
      .select()
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, userId1), eq(blocks.blockedId, userId2)),
          and(eq(blocks.blockerId, userId2), eq(blocks.blockedId, userId1))
        )
      )
      .limit(1);

    return !!block;
  }
}
