import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { posts, profiles, likes, follows } from '../db/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { CreatePostDto } from './dto/create-post.dto';

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
        visibility:
          (createPostDto.visibility as 'public' | 'followers') || 'public',
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
        visibility: posts.visibility,
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
      visibility: post.visibility,
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

  // Following feed (takip ettiklerimin postları)
  async getFollowingFeed(userId: string, limit = 20, offset = 0) {
    // Takip ettiğim kullanıcıları al
    const following = await this.dbService.db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const followingIds = following.map((f) => f.followingId);

    // Eğer kimseyi takip etmiyorsa boş array döndür
    if (followingIds.length === 0) {
      return [];
    }

    // Takip ettiklerimin postlarını getir
    const postsList = await this.dbService.db
      .select({
        id: posts.id,
        authorId: posts.authorId,
        text: posts.text,
        audioUrl: posts.audioUrl,
        visibility: posts.visibility,
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
      .where(inArray(posts.authorId, followingIds))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    // Her post için like bilgilerini ekle
    return Promise.all(
      postsList.map((post) => this.enrichPostDrizzle(post, userId))
    );
  }

  // For You feed (public postlar)
  async getDiscoverFeed(userId: string, limit = 20, offset = 0) {
    const postsList = await this.dbService.db
      .select({
        id: posts.id,
        authorId: posts.authorId,
        text: posts.text,
        audioUrl: posts.audioUrl,
        visibility: posts.visibility,
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
      .where(eq(posts.visibility, 'public'))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    return Promise.all(
      postsList.map((post) => this.enrichPostDrizzle(post, userId))
    );
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
      visibility: post.visibility,
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
}
