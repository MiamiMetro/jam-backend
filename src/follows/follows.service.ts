import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { follows, profiles } from '../db/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class FollowsService {
  constructor(private dbService: DbService) {}

  // Kullanıcıyı takip et
  async followUser(followerId: string, followingId: string) {
    // Kendini takip edemez
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Zaten takip ediyor mu kontrol et
    const [existingFollow] = await this.dbService.db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      )
      .limit(1);

    if (existingFollow) {
      throw new BadRequestException('Already following this user');
    }

    // Takip et
    const [newFollow] = await this.dbService.db
      .insert(follows)
      .values({
        followerId: followerId,
        followingId: followingId,
      })
      .returning();

    if (!newFollow) {
      throw new BadRequestException('Failed to follow user');
    }

    return newFollow;
  }

  // Takibi bırak
  async unfollowUser(followerId: string, followingId: string) {
    const [deleted] = await this.dbService.db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException('Follow relationship not found');
    }

    return { message: 'Successfully unfollowed user' };
  }

  // Takip ettiklerim (ben kimi takip ediyorum)
  async getFollowing(userId: string) {
    const followingList = await this.dbService.db
      .select({
        followingId: follows.followingId,
        createdAt: follows.createdAt,
        profile: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          bio: profiles.bio,
        },
      })
      .from(follows)
      .innerJoin(profiles, eq(follows.followingId, profiles.id))
      .where(eq(follows.followerId, userId));

    return followingList.map((follow) => ({
      ...follow.profile,
      display_name: follow.profile.displayName,
      avatar_url: follow.profile.avatarUrl,
      followed_at: follow.createdAt,
    }));
  }

  // Takipçilerim (beni kim takip ediyor)
  async getFollowers(userId: string) {
    const followersList = await this.dbService.db
      .select({
        followerId: follows.followerId,
        createdAt: follows.createdAt,
        profile: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          bio: profiles.bio,
        },
      })
      .from(follows)
      .innerJoin(profiles, eq(follows.followerId, profiles.id))
      .where(eq(follows.followingId, userId));

    return followersList.map((follow) => ({
      ...follow.profile,
      display_name: follow.profile.displayName,
      avatar_url: follow.profile.avatarUrl,
      followed_at: follow.createdAt,
    }));
  }

  // Belirli bir kullanıcının takip ettikleri
  async getUserFollowing(userId: string) {
    return this.getFollowing(userId);
  }

  // Belirli bir kullanıcının takipçileri
  async getUserFollowers(userId: string) {
    return this.getFollowers(userId);
  }

  // İki kullanıcı arasında takip ilişkisi var mı (helper)
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [follow] = await this.dbService.db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      )
      .limit(1);

    return !!follow;
  }
}
