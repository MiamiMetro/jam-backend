import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { profiles } from '../db/schema';
import { eq, sql, ilike, or, and, ne } from 'drizzle-orm';

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

      // Add timeout to prevent hanging (reduced to 5 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 5s')), 5000)
      );

      // Build where conditions
      const conditions: any[] = [];

      // Exclude current user if provided
      if (currentUserId) {
        conditions.push(ne(profiles.id, currentUserId));
      }

      // Add search condition if provided
      if (search) {
        conditions.push(
          or(
            ilike(profiles.username, `%${search}%`),
            ilike(profiles.displayName, `%${search}%`)
          )
        );
      }

      // Get total count
      const countPromise = this.dbService.db
        .select({ count: sql<number>`count(*)` })
        .from(profiles)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const [totalResult] = (await Promise.race([
        countPromise,
        timeoutPromise,
      ])) as any;

      console.log(
        `[getAllUsers] Count query completed in ${Date.now() - startTime}ms`
      );

      const total = Number(totalResult?.count || 0);

      console.log('[getAllUsers] Executing users query...');
      const usersStartTime = Date.now();

      // Create separate timeout for users query
      const usersTimeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Users query timeout after 5s')),
          5000
        )
      );

      // Get users
      const usersListPromise = this.dbService.db
        .select({
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit)
        .offset(offset);

      const usersList = (await Promise.race([
        usersListPromise,
        usersTimeoutPromise,
      ])) as any;

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

    const conditions: any[] = [];
    if (currentUserId) {
      conditions.push(ne(profiles.id, currentUserId));
    }

    // Get total count
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(profiles)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(totalResult?.count || 0);

    // Get users (for now, return all users as "online" is not implemented)
    // In the future, this should filter by online status
    const usersList = await this.dbService.db
      .select({
        id: profiles.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset);

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
