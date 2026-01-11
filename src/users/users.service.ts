import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class UsersService {
  constructor(private dbService: DbService) {}

  // Get all users (for search/discovery)
  async getAllUsers(
    limit = 20,
    offset = 0,
    search?: string,
    currentUserId?: string
  ) {
    console.log('[getAllUsers] Starting, connected:', this.dbService.connected);

    // Check if database is connected
    if (!this.dbService.connected) {
      console.warn(
        '[getAllUsers] Database not connected, returning empty users list'
      );
      return {
        data: [],
        limit,
        offset,
        total: 0,
        hasMore: false,
      };
    }

    try {
      console.log('[getAllUsers] Executing count query...');
      const startTime = Date.now();

      // Build where conditions
      const where: any = {};

      // Exclude current user if provided
      if (currentUserId) {
        where.id = { not: currentUserId };
      }

      // Add search condition if provided
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get total count
      const total = await this.dbService.profile.count({ where });

      console.log(
        `[getAllUsers] Count query completed in ${Date.now() - startTime}ms`
      );

      console.log('[getAllUsers] Executing users query...');
      const usersStartTime = Date.now();

      // Get users
      const usersList = await this.dbService.profile.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
        take: limit,
        skip: offset,
      });

      console.log(
        `[getAllUsers] Users query completed in ${Date.now() - usersStartTime}ms, found ${usersList.length} users`
      );

      const hasMore = offset + limit < total;

      return {
        data: usersList.map((user) => ({
          id: user.id,
          username: user.username,
          avatar_url: user.avatarUrl || undefined,
          status: 'offline', // TODO: Implement online status tracking
          statusMessage: '', // TODO: Add status message field to schema if needed
        })),
        limit,
        offset,
        total,
        hasMore,
      };
    } catch (error: any) {
      console.error('[getAllUsers] Error:', error?.message || error);
      console.error('[getAllUsers] Stack:', error?.stack);
      return {
        data: [],
        limit,
        offset,
        total: 0,
        hasMore: false,
      };
    }
  }

  // Get online users only
  async getOnlineUsers(limit = 50, offset = 0, currentUserId?: string) {
    // For now, we don't have online status tracking
    // This is a placeholder that returns empty or all users
    // TODO: Implement online status tracking in the future

    const where: any = {};
    if (currentUserId) {
      where.id = { not: currentUserId };
    }

    // Get total count
    const total = await this.dbService.profile.count({ where });

    // Get users (for now, return all users as "online" is not implemented)
    // In the future, this should filter by online status
    const usersList = await this.dbService.profile.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
      take: limit,
      skip: offset,
    });

    const hasMore = offset + limit < total;

    return {
      data: usersList.map((user) => ({
        id: user.id,
        username: user.username,
        avatar_url: user.avatarUrl || undefined,
        status: 'online', // Placeholder - will be implemented later
        statusMessage: '', // TODO: Add status message field to schema if needed
      })),
      limit,
      offset,
      total,
      hasMore,
    };
  }
}
