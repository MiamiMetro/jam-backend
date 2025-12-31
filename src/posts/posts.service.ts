import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { posts, profiles, likes, comments } from '../db/schema';
import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class PostsService {
  constructor(private dbService: DbService) {}

  // Post oluştur
  async createPost(authorId: string, createPostDto: CreatePostDto) {
    // Text veya audio en az biri olmalı
    if (!createPostDto.text && !createPostDto.audio_url) {
      throw new BadRequestException('Post must have either text or audio');
    }

    const [newPost] = await this.dbService.db
      .insert(posts)
      .values({
        authorId: authorId,
        text: createPostDto.text || null,
        audioUrl: createPostDto.audio_url || null,
      })
      .returning();

    if (!newPost) {
      throw new BadRequestException('Failed to create post');
    }

    return this.getPostById(newPost.id, authorId);
  }

  // Tek post getir
  async getPostById(postId: string, currentUserId?: string) {
    const [post] = await this.dbService.db
      .select({
        id: posts.id,
        authorId: posts.authorId,
        text: posts.text,
        audioUrl: posts.audioUrl,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        author: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(posts)
      .innerJoin(profiles, eq(posts.authorId, profiles.id))
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Like sayısı
    const [likesResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(likes)
      .where(eq(likes.postId, postId));

    const likesCount = Number(likesResult?.count || 0);

    // Kullanıcı beğenmiş mi?
    let isLiked = false;
    if (currentUserId) {
      const [like] = await this.dbService.db
        .select()
        .from(likes)
        .where(and(eq(likes.postId, postId), eq(likes.userId, currentUserId)))
        .limit(1);

      isLiked = !!like;
    }

    return {
      id: post.id,
      author_id: post.authorId,
      text: post.text || '',
      audio_url: post.audioUrl || '',
      created_at: post.createdAt.toISOString(),
      author: {
        id: post.author.id,
        username: post.author.username,
        display_name: post.author.displayName || '',
        avatar_url: post.author.avatarUrl || '',
      },
      likes_count: likesCount,
      is_liked: isLiked,
    };
  }

  // Global feed (tüm public postlar)
  async getFeed(currentUserId: string | undefined, limit = 20, offset = 0) {
    console.log('[getFeed] Starting, connected:', this.dbService.connected);
    
    // Check if database is connected
    if (!this.dbService.connected) {
      console.warn('[getFeed] Database not connected, returning empty feed');
      return {
        data: [],
        limit,
        offset,
        total: 0,
        hasMore: false,
      };
    }

    try {
      console.log('[getFeed] Executing count query...');
      const startTime = Date.now();
      
      // Add timeout to prevent hanging (reduced to 5 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 5s')), 5000)
      );

      // Get total count
      const countPromise = this.dbService.db
        .select({ count: sql<number>`count(*)` })
        .from(posts);

      const [totalResult] = await Promise.race([
        countPromise,
        timeoutPromise,
      ]) as any;
      
      console.log(`[getFeed] Count query completed in ${Date.now() - startTime}ms`);

      const total = Number(totalResult?.count || 0);

      console.log('[getFeed] Executing posts query...');
      const postsStartTime = Date.now();
      
      // Create separate timeout for posts query
      const postsTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Posts query timeout after 5s')), 5000)
      );

      const postsListPromise = this.dbService.db
        .select({
          id: posts.id,
          authorId: posts.authorId,
          text: posts.text,
          audioUrl: posts.audioUrl,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
          author: {
            id: profiles.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
          },
        })
        .from(posts)
        .innerJoin(profiles, eq(posts.authorId, profiles.id))
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);
      
      const postsList = await Promise.race([
        postsListPromise,
        postsTimeoutPromise,
      ]) as any;
      
      console.log(`[getFeed] Posts query completed in ${Date.now() - postsStartTime}ms, found ${postsList.length} posts`);

      const data = await Promise.all(
        postsList.map((post) => this.enrichPostDrizzle(post, currentUserId))
      );

      const hasMore = offset + limit < total;

      return {
        data,
        limit,
        offset,
        total,
        hasMore,
      };
    } catch (error: any) {
      console.error('[getFeed] Error:', error?.message || error);
      console.error('[getFeed] Stack:', error?.stack);
      // Return empty feed on timeout or error
      return {
        data: [],
        limit,
        offset,
        total: 0,
        hasMore: false,
      };
    }
  }

  // Post sil
  async deletePost(postId: string, userId: string) {
    // Post'un sahibi mi kontrol et
    const [post] = await this.dbService.db
      .select({ authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.dbService.db.delete(posts).where(eq(posts.id, postId));

    return { message: 'Post deleted successfully' };
  }

  // Like / Unlike
  async toggleLike(postId: string, userId: string) {
    // Post var mı kontrol et
    const [post] = await this.dbService.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Zaten beğenmiş mi?
    const [existingLike] = await this.dbService.db
      .select()
      .from(likes)
      .where(and(eq(likes.postId, postId), eq(likes.userId, userId)))
      .limit(1);

    if (existingLike) {
      // Unlike
      await this.dbService.db
        .delete(likes)
        .where(and(eq(likes.postId, postId), eq(likes.userId, userId)));

      return { liked: false, message: 'Post unliked' };
    } else {
      // Like
      await this.dbService.db.insert(likes).values({
        postId: postId,
        userId: userId,
      });

      return { liked: true, message: 'Post liked' };
    }
  }

  // Post'u like bilgileriyle zenginleştir (helper) - Drizzle version
  private async enrichPostDrizzle(post: any, userId?: string) {
    // Like sayısı
    const [likesResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(likes)
      .where(eq(likes.postId, post.id));

    const likesCount = Number(likesResult?.count || 0);

    // Kullanıcı beğenmiş mi?
    let isLiked = false;
    if (userId) {
      const [like] = await this.dbService.db
        .select()
        .from(likes)
        .where(and(eq(likes.postId, post.id), eq(likes.userId, userId)))
        .limit(1);

      isLiked = !!like;
    }

    return {
      id: post.id,
      author_id: post.authorId,
      text: post.text || '',
      audio_url: post.audioUrl || '',
      created_at: post.createdAt.toISOString(),
      author: {
        id: post.author.id,
        username: post.author.username,
        display_name: post.author.displayName || '',
        avatar_url: post.author.avatarUrl || '',
      },
      likes_count: likesCount,
      is_liked: isLiked,
    };
  }

  // Gönderiyi beğenenler listesi
  async getPostLikes(postId: string) {
    const likesList = await this.dbService.db
      .select({
        userId: likes.userId,
        createdAt: likes.createdAt,
        profile: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(likes)
      .innerJoin(profiles, eq(likes.userId, profiles.id))
      .where(eq(likes.postId, postId));

    return likesList.map((like) => ({
      ...like.profile,
      display_name: like.profile.displayName,
      avatar_url: like.profile.avatarUrl,
      liked_at: like.createdAt,
    }));
  }

  // Get comments for a post
  async getComments(
    postId: string,
    limit = 20,
    offset = 0,
    order: 'asc' | 'desc' = 'asc'
  ) {
    // Check if post exists
    const [post] = await this.dbService.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Get total count
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(eq(comments.postId, postId));

    const total = Number(totalResult?.count || 0);

    // Get comments
    const commentsList = await this.dbService.db
      .select({
        id: comments.id,
        postId: comments.postId,
        text: comments.text,
        audioUrl: comments.audioUrl,
        createdAt: comments.createdAt,
        author: {
          username: profiles.username,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(comments)
      .innerJoin(profiles, eq(comments.authorId, profiles.id))
      .where(eq(comments.postId, postId))
      .orderBy(
        order === 'desc' ? desc(comments.createdAt) : asc(comments.createdAt)
      )
      .limit(limit)
      .offset(offset);

    const hasMore = offset + limit < total;

    return {
      data: commentsList.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        author: {
          username: comment.author.username,
          avatar: comment.author.avatarUrl || undefined,
        },
        content: comment.text || undefined,
        audio_url: comment.audioUrl || null,
        timestamp: comment.createdAt.toISOString(),
      })),
      limit,
      offset,
      total,
      hasMore,
    };
  }

  // Create a comment on a post
  async createComment(
    postId: string,
    authorId: string,
    createCommentDto: CreateCommentDto
  ) {
    // Check if post exists
    const [post] = await this.dbService.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Text or audio must be provided
    if (!createCommentDto.content && !createCommentDto.audio_url) {
      throw new BadRequestException(
        'Comment must have either content or audio_url'
      );
    }

    // Create comment
    const [newComment] = await this.dbService.db
      .insert(comments)
      .values({
        postId: postId,
        authorId: authorId,
        text: createCommentDto.content || null,
        audioUrl: createCommentDto.audio_url || null,
      })
      .returning();

    if (!newComment) {
      throw new BadRequestException('Failed to create comment');
    }

    // Get author profile
    const [author] = await this.dbService.db
      .select({
        username: profiles.username,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(eq(profiles.id, authorId))
      .limit(1);

    return {
      id: newComment.id,
      postId: newComment.postId,
      author: {
        username: author?.username || '',
        avatar_url: author?.avatarUrl || undefined,
      },
      content: newComment.text || undefined,
      audio_url: newComment.audioUrl || null,
      timestamp: newComment.createdAt.toISOString(),
    };
  }

  // Get posts by username
  async getPostsByUsername(
    username: string,
    currentUserId: string | undefined,
    limit = 20,
    offset = 0
  ) {
    // Get user profile
    const [userProfile] = await this.dbService.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);

    if (!userProfile) {
      throw new NotFoundException('User not found');
    }

    // Get total count
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.authorId, userProfile.id));

    const total = Number(totalResult?.count || 0);

    // Get posts
    const postsList = await this.dbService.db
      .select({
        id: posts.id,
        authorId: posts.authorId,
        text: posts.text,
        audioUrl: posts.audioUrl,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        author: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(posts)
      .innerJoin(profiles, eq(posts.authorId, profiles.id))
      .where(eq(posts.authorId, userProfile.id))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    const enrichedPosts = await Promise.all(
      postsList.map((post) => this.enrichPostDrizzle(post, currentUserId))
    );

    const hasMore = offset + limit < total;

    return {
      data: enrichedPosts,
      limit,
      offset,
      total,
      hasMore,
    };
  }
}
