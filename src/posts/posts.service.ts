import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { posts, profiles, likes } from '../db/schema';
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
        parentId: null, // Top-level post
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

    // Comments count
    const [commentsResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.parentId, postId));

    const commentsCount = Number(commentsResult?.count || 0);

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
      comments_count: commentsCount,
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

      // Get total count (only top-level posts)
      const countPromise = this.dbService.db
        .select({ count: sql<number>`count(*)` })
        .from(posts)
        .where(sql`parent_id IS NULL`);

      const [totalResult] = (await Promise.race([
        countPromise,
        timeoutPromise,
      ])) as any;

      console.log(
        `[getFeed] Count query completed in ${Date.now() - startTime}ms`
      );

      const total = Number(totalResult?.count || 0);

      console.log('[getFeed] Executing posts query...');
      const postsStartTime = Date.now();

      // Create separate timeout for posts query
      const postsTimeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Posts query timeout after 5s')),
          5000
        )
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
        .where(sql`${posts.parentId} IS NULL`)
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);

      const postsList = (await Promise.race([
        postsListPromise,
        postsTimeoutPromise,
      ])) as any;

      console.log(
        `[getFeed] Posts query completed in ${Date.now() - postsStartTime}ms, found ${postsList.length} posts`
      );

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
    } else {
      // Like
      await this.dbService.db.insert(likes).values({
        postId: postId,
        userId: userId,
      });
    }

    // Return the updated post with correct is_liked status
    return this.getPostById(postId, userId);
  }

  // Post'u like bilgileriyle zenginleştir (helper) - Drizzle version
  private async enrichPostDrizzle(post: any, userId?: string) {
    // Like sayısı
    const [likesResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(likes)
      .where(eq(likes.postId, post.id));

    const likesCount = Number(likesResult?.count || 0);

    // Comments count (posts with this post as parent)
    const [commentsResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.parentId, post.id));

    const commentsCount = Number(commentsResult?.count || 0);

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
      comments_count: commentsCount,
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
    currentUserId: string | undefined,
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

    // Get total count (posts with this post as parent)
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.parentId, postId));

    const total = Number(totalResult?.count || 0);

    // Get comments (posts with parent_id = postId)
    const commentsList = await this.dbService.db
      .select({
        id: posts.id,
        parentId: posts.parentId,
        authorId: posts.authorId,
        text: posts.text,
        audioUrl: posts.audioUrl,
        createdAt: posts.createdAt,
        author: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(posts)
      .innerJoin(profiles, eq(posts.authorId, profiles.id))
      .where(eq(posts.parentId, postId))
      .orderBy(order === 'desc' ? desc(posts.createdAt) : asc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    const hasMore = offset + limit < total;

    // Enrich comments with like info
    const enrichedComments = await Promise.all(
      commentsList.map(async (comment) => {
        // Get likes count
        const [likesResult] = await this.dbService.db
          .select({ count: sql<number>`count(*)` })
          .from(likes)
          .where(eq(likes.postId, comment.id));

        const likesCount = Number(likesResult?.count || 0);

        // Check if user liked this comment
        let isLiked = false;
        if (currentUserId) {
          const [like] = await this.dbService.db
            .select()
            .from(likes)
            .where(
              and(eq(likes.postId, comment.id), eq(likes.userId, currentUserId))
            )
            .limit(1);

          isLiked = !!like;
        }

        return {
          id: comment.id,
          author_id: comment.authorId,
          author: {
            id: comment.author.id,
            username: comment.author.username,
            display_name: comment.author.displayName || '',
            avatar_url: comment.author.avatarUrl || '',
          },
          text: comment.text || '',
          audio_url: comment.audioUrl || '',
          created_at: comment.createdAt.toISOString(),
          likes_count: likesCount,
          is_liked: isLiked,
        };
      })
    );

    return {
      data: enrichedComments,
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

    // Create comment as a post with parent_id
    const [newComment] = await this.dbService.db
      .insert(posts)
      .values({
        authorId: authorId,
        parentId: postId,
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
        id: profiles.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(eq(profiles.id, authorId))
      .limit(1);

    return {
      id: newComment.id,
      author_id: newComment.authorId,
      author: {
        id: author?.id || '',
        username: author?.username || '',
        display_name: author?.displayName || '',
        avatar_url: author?.avatarUrl || '',
      },
      text: newComment.text || '',
      audio_url: newComment.audioUrl || '',
      created_at: newComment.createdAt.toISOString(),
      likes_count: 0,
      is_liked: false,
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

    // Get total count (only top-level posts)
    const [totalResult] = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(
        and(eq(posts.authorId, userProfile.id), sql`${posts.parentId} IS NULL`)
      );

    const total = Number(totalResult?.count || 0);

    // Get posts (only top-level)
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
      .where(
        and(eq(posts.authorId, userProfile.id), sql`${posts.parentId} IS NULL`)
      )
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
