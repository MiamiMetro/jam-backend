import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
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

    const newPost = await this.dbService.post.create({
      data: {
        authorId: authorId,
        parentId: null, // Top-level post
        text: createPostDto.text || null,
        audioUrl: createPostDto.audio_url || null,
      },
    });

    if (!newPost) {
      throw new BadRequestException('Failed to create post');
    }

    return this.getPostById(newPost.id, authorId);
  }

  // Tek post getir
  async getPostById(postId: string, currentUserId?: string) {
    const post = await this.dbService.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Like sayısı
    const likesCount = await this.dbService.like.count({
      where: { postId: postId },
    });

    // Comments count
    const commentsCount = await this.dbService.post.count({
      where: { parentId: postId },
    });

    // Kullanıcı beğenmiş mi?
    let isLiked = false;
    if (currentUserId) {
      const like = await this.dbService.like.findFirst({
        where: {
          postId: postId,
          userId: currentUserId,
        },
      });
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

      // Get total count (only top-level posts)
      const total = await this.dbService.post.count({
        where: { parentId: null },
      });

      console.log(
        `[getFeed] Count query completed in ${Date.now() - startTime}ms`
      );

      console.log('[getFeed] Executing posts query...');
      const postsStartTime = Date.now();

      const postsList = await this.dbService.post.findMany({
        where: { parentId: null },
        include: {
          author: {
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

      console.log(
        `[getFeed] Posts query completed in ${Date.now() - postsStartTime}ms, found ${postsList.length} posts`
      );

      const data = await Promise.all(
        postsList.map((post) => this.enrichPost(post, currentUserId))
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
    const post = await this.dbService.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.dbService.post.delete({
      where: { id: postId },
    });

    return { message: 'Post deleted successfully' };
  }

  // Like / Unlike
  async toggleLike(postId: string, userId: string) {
    // Post var mı kontrol et
    const post = await this.dbService.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Zaten beğenmiş mi?
    const existingLike = await this.dbService.like.findFirst({
      where: {
        postId: postId,
        userId: userId,
      },
    });

    if (existingLike) {
      // Unlike
      await this.dbService.like.delete({
        where: { id: existingLike.id },
      });
    } else {
      // Like
      await this.dbService.like.create({
        data: {
          postId: postId,
          userId: userId,
        },
      });
    }

    // Return the updated post with correct is_liked status
    return this.getPostById(postId, userId);
  }

  // Post'u like bilgileriyle zenginleştir (helper)
  private async enrichPost(post: any, userId?: string) {
    // Like sayısı
    const likesCount = await this.dbService.like.count({
      where: { postId: post.id },
    });

    // Comments count (posts with this post as parent)
    const commentsCount = await this.dbService.post.count({
      where: { parentId: post.id },
    });

    // Kullanıcı beğenmiş mi?
    let isLiked = false;
    if (userId) {
      const like = await this.dbService.like.findFirst({
        where: {
          postId: post.id,
          userId: userId,
        },
      });
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
    const likesList = await this.dbService.like.findMany({
      where: { postId: postId },
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
    });

    return likesList.map((like) => ({
      id: like.user.id,
      username: like.user.username,
      display_name: like.user.displayName || '',
      avatar_url: like.user.avatarUrl || '',
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
    const post = await this.dbService.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Get total count (posts with this post as parent)
    const total = await this.dbService.post.count({
      where: { parentId: postId },
    });

    // Get comments (posts with parent_id = postId)
    const commentsList = await this.dbService.post.findMany({
      where: { parentId: postId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: order },
      take: limit,
      skip: offset,
    });

    const hasMore = offset + limit < total;

    // Enrich comments with like info
    const enrichedComments = await Promise.all(
      commentsList.map(async (comment) => {
        // Get likes count
        const likesCount = await this.dbService.like.count({
          where: { postId: comment.id },
        });

        // Check if user liked this comment
        let isLiked = false;
        if (currentUserId) {
          const like = await this.dbService.like.findFirst({
            where: {
              postId: comment.id,
              userId: currentUserId,
            },
          });
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
    const post = await this.dbService.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

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
    const newComment = await this.dbService.post.create({
      data: {
        authorId: authorId,
        parentId: postId,
        text: createCommentDto.content || null,
        audioUrl: createCommentDto.audio_url || null,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!newComment) {
      throw new BadRequestException('Failed to create comment');
    }

    return {
      id: newComment.id,
      author_id: newComment.authorId,
      author: {
        id: newComment.author.id,
        username: newComment.author.username,
        display_name: newComment.author.displayName || '',
        avatar_url: newComment.author.avatarUrl || '',
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
    const userProfile = await this.dbService.profile.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!userProfile) {
      throw new NotFoundException('User not found');
    }

    // Get total count (only top-level posts)
    const total = await this.dbService.post.count({
      where: {
        authorId: userProfile.id,
        parentId: null,
      },
    });

    // Get posts (only top-level)
    const postsList = await this.dbService.post.findMany({
      where: {
        authorId: userProfile.id,
        parentId: null,
      },
      include: {
        author: {
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

    const enrichedPosts = await Promise.all(
      postsList.map((post) => this.enrichPost(post, currentUserId))
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
