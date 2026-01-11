import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';

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
    const friendProfile = await this.dbService.profile.findUnique({
      where: { id: friendId },
      select: { id: true },
    });

    if (!friendProfile) {
      throw new NotFoundException('User not found');
    }

    // Check if friendship already exists
    const existing = await this.dbService.friend.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new BadRequestException('Users are already friends');
      }
      if (existing.userId === userId) {
        throw new BadRequestException('Friend request already sent');
      }
      // If the other user sent a request, accept it instead
      const updated = await this.dbService.friend.update({
        where: { id: existing.id },
        data: { status: 'accepted' },
      });

      return { message: 'Friend request accepted', status: 'accepted' };
    }

    // Create friend request
    const newRequest = await this.dbService.friend.create({
      data: {
        userId: userId,
        friendId: friendId,
        status: 'pending',
      },
    });

    if (!newRequest) {
      throw new BadRequestException('Failed to send friend request');
    }

    return { message: 'Friend request sent', status: 'pending' };
  }

  // Accept friend request
  async acceptFriendRequest(userId: string, friendId: string) {
    // Find pending request where friendId is the requester
    const request = await this.dbService.friend.findFirst({
      where: {
        userId: friendId,
        friendId: userId,
        status: 'pending',
      },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    // Update to accepted
    const updated = await this.dbService.friend.update({
      where: { id: request.id },
      data: { status: 'accepted' },
    });

    if (!updated) {
      throw new BadRequestException('Failed to accept friend request');
    }

    return { message: 'Friend request accepted', status: 'accepted' };
  }

  // Delete friend / cancel request / unfriend
  async deleteFriend(userId: string, friendId: string) {
    const deleted = await this.dbService.friend.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Friendship not found');
    }

    return { message: 'Friend removed successfully' };
  }

  // Get all friends (accepted only)
  async getFriends(userId: string, limit = 50, offset = 0) {
    // Get total count
    const total = await this.dbService.friend.count({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
    });

    // Get friendships where user is userId or friendId
    const friendships = await this.dbService.friend.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

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
    const profilesList = await this.dbService.profile.findMany({
      where: { id: { in: friendIds } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });

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
    const total = await this.dbService.friend.count({
      where: {
        friendId: userId,
        status: 'pending',
      },
    });

    const requestsList = await this.dbService.friend.findMany({
      where: {
        friendId: userId,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const data = requestsList.map((request) => ({
      id: request.user.id,
      username: request.user.username,
      display_name: request.user.displayName || '',
      avatar_url: request.user.avatarUrl || '',
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
    const friendship = await this.dbService.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { userId: userId1, friendId: userId2 },
          { userId: userId2, friendId: userId1 },
        ],
      },
    });

    return !!friendship;
  }
}
