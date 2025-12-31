import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { friends, profiles } from '../db/schema';
import { eq, and, or, desc, inArray, sql } from 'drizzle-orm';

@Injectable()
export class FriendsService {
  constructor(private dbService: DbService) {}

  // Send friend request
  async requestFriend(userId: string, friendId: string) {
    // Cannot send request to self
    if (userId === friendId) {
      throw new BadRequestException(
        'You cannot send friend request to yourself'
      );
    }

    // Check if friend exists
    const [friendProfile] = await this.dbService.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, friendId))
      .limit(1);

    if (!friendProfile) {
      throw new NotFoundException('User not found');
    }

    // Check if friendship already exists
    const [existing] = await this.dbService.db
      .select()
      .from(friends)
      .where(
        or(
          and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
          and(eq(friends.userId, friendId), eq(friends.friendId, userId))
        )
      )
      .limit(1);

    if (existing) {
      if (existing.status === 'accepted') {
        throw new BadRequestException('Users are already friends');
      }
      if (existing.userId === userId) {
        throw new BadRequestException('Friend request already sent');
      }
      // If the other user sent a request, accept it instead
      await this.dbService.db
        .update(friends)
        .set({ status: 'accepted' })
        .where(eq(friends.id, existing.id));

      return { message: 'Friend request accepted', status: 'accepted' };
    }

    // Create friend request
    const [newRequest] = await this.dbService.db
      .insert(friends)
      .values({
        userId: userId,
        friendId: friendId,
        status: 'pending',
      })
      .returning();

    if (!newRequest) {
      throw new BadRequestException('Failed to send friend request');
    }

    return { message: 'Friend request sent', status: 'pending' };
  }

  // Accept friend request
  async acceptFriendRequest(userId: string, friendId: string) {
    // Find pending request where friendId is the requester
    const [request] = await this.dbService.db
      .select()
      .from(friends)
      .where(
        and(
          eq(friends.userId, friendId),
          eq(friends.friendId, userId),
          eq(friends.status, 'pending')
        )
      )
      .limit(1);

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    // Update to accepted
    const [updated] = await this.dbService.db
      .update(friends)
      .set({ status: 'accepted' })
      .where(eq(friends.id, request.id))
      .returning();

    if (!updated) {
      throw new BadRequestException('Failed to accept friend request');
    }

    return { message: 'Friend request accepted', status: 'accepted' };
  }

  // Delete friend / cancel request / unfriend
  async deleteFriend(userId: string, friendId: string) {
    const [deleted] = await this.dbService.db
      .delete(friends)
      .where(
        or(
          and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
          and(eq(friends.userId, friendId), eq(friends.friendId, userId))
        )
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException('Friendship not found');
    }

    return { message: 'Friend removed successfully' };
  }

  // Get all friends (accepted only)
  async getFriends(userId: string, limit = 50, offset = 0) {
    // Get total count
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(friends)
      .where(
        and(
          eq(friends.status, 'accepted'),
          or(eq(friends.userId, userId), eq(friends.friendId, userId))
        )
      );

    const total = Number(totalResult?.count || 0);

    // Get friendships where user is userId or friendId
    const friendships = await this.dbService.db
      .select()
      .from(friends)
      .where(
        and(
          eq(friends.status, 'accepted'),
          or(eq(friends.userId, userId), eq(friends.friendId, userId))
        )
      )
      .orderBy(desc(friends.createdAt))
      .limit(limit)
      .offset(offset);

    // Get friend IDs (the other user in each friendship)
    const friendIds = friendships.map((f) =>
      f.userId === userId ? f.friendId : f.userId
    );

    if (friendIds.length === 0) {
      return {
        data: [],
        limit,
        offset,
        total: 0,
        hasMore: false,
      };
    }

    // Get profiles for all friends
    const profilesList = await this.dbService.db
      .select({
        id: profiles.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(inArray(profiles.id, friendIds));

    // Create a map for quick lookup
    const profileMap = new Map(profilesList.map((p) => [p.id, p]));

    // Combine with friendship dates
    const data = friendships
      .map((friendship) => {
        const friendId =
          friendship.userId === userId
            ? friendship.friendId
            : friendship.userId;
        const profile = profileMap.get(friendId);

        if (!profile) return null;

        return {
          id: profile.id,
          username: profile.username,
          display_name: profile.displayName || '',
          avatar_url: profile.avatarUrl || '',
          friends_since: friendship.createdAt,
        };
      })
      .filter(Boolean);

    const hasMore = offset + limit < total;

    return {
      data,
      limit,
      offset,
      total,
      hasMore,
    };
  }

  // Get pending friend requests (requests sent to me)
  async getFriendRequests(userId: string, limit = 20, offset = 0) {
    // Get total count
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(friends)
      .where(and(eq(friends.friendId, userId), eq(friends.status, 'pending')));

    const total = Number(totalResult?.count || 0);

    const requestsList = await this.dbService.db
      .select({
        id: friends.id,
        userId: friends.userId,
        friendId: friends.friendId,
        createdAt: friends.createdAt,
        profile: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(friends)
      .innerJoin(profiles, eq(friends.userId, profiles.id))
      .where(and(eq(friends.friendId, userId), eq(friends.status, 'pending')))
      .orderBy(desc(friends.createdAt))
      .limit(limit)
      .offset(offset);

    const data = requestsList.map((request) => ({
      id: request.profile.id,
      username: request.profile.username,
      display_name: request.profile.displayName || '',
      avatar_url: request.profile.avatarUrl || '',
      requested_at: request.createdAt,
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

  // Check if two users are friends (helper)
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const [friendship] = await this.dbService.db
      .select()
      .from(friends)
      .where(
        and(
          or(
            and(eq(friends.userId, userId1), eq(friends.friendId, userId2)),
            and(eq(friends.userId, userId2), eq(friends.friendId, userId1))
          ),
          eq(friends.status, 'accepted')
        )
      )
      .limit(1);

    return !!friendship;
  }
}
