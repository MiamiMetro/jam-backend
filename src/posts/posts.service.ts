import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private supabaseService: SupabaseService) {}

  // Post oluştur
  async createPost(authorId: string, createPostDto: CreatePostDto) {
    const supabase = this.supabaseService.getClient();

    // Text veya audio en az biri olmalı
    if (!createPostDto.text && !createPostDto.audio_url) {
      throw new BadRequestException('Post must have either text or audio');
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: authorId,
        text: createPostDto.text,
        audio_url: createPostDto.audio_url,
        visibility: createPostDto.visibility || 'public',
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to create post');
    }

    return this.getPostById(data.id, authorId);
  }

  // Tek post getir
  async getPostById(postId: string, currentUserId?: string) {
    const supabase = this.supabaseService.getClient();

    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('id', postId)
      .single();

    if (error || !post) {
      throw new NotFoundException('Post not found');
    }

    // Like sayısı
    const { count: likesCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    // Kullanıcı beğenmiş mi?
    let isLiked = false;
    if (currentUserId) {
      const { data: like } = await supabase
        .from('likes')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', currentUserId)
        .single();
      
      isLiked = !!like;
    }

    return {
      ...post,
      author: post.profiles,
      likes_count: likesCount || 0,
      is_liked: isLiked,
    };
  }

  // Following feed (takip ettiklerimin postları)
  async getFollowingFeed(userId: string, limit = 20, offset = 0) {
    const supabase = this.supabaseService.getClient();

    // Takip ettiğim kullanıcıları al
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = following?.map(f => f.following_id) || [];

    // Eğer kimseyi takip etmiyorsa boş array döndür
    if (followingIds.length === 0) {
      return [];
    }

    // Takip ettiklerimin postlarını getir
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .in('author_id', followingIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new BadRequestException('Failed to fetch feed');
    }

    // Her post için like bilgilerini ekle
    return Promise.all(posts.map(post => this.enrichPost(post, userId)));
  }

  // For You feed (public postlar)
  async getDiscoverFeed(userId: string, limit = 20, offset = 0) {
    const supabase = this.supabaseService.getClient();

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new BadRequestException('Failed to fetch discover feed');
    }

    return Promise.all(posts.map(post => this.enrichPost(post, userId)));
  }

  // Post sil
  async deletePost(postId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Post'un sahibi mi kontrol et
    const { data: post } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.author_id !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      throw new BadRequestException('Failed to delete post');
    }

    return { message: 'Post deleted successfully' };
  }

  // Like / Unlike
  async toggleLike(postId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Post var mı kontrol et
    const { data: post } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .single();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Zaten beğenmiş mi?
    const { data: existingLike } = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (existingLike) {
      // Unlike
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      return { liked: false, message: 'Post unliked' };
    } else {
      // Like
      await supabase
        .from('likes')
        .insert({
          post_id: postId,
          user_id: userId,
        });

      return { liked: true, message: 'Post liked' };
    }
  }

  // Post'u like bilgileriyle zenginleştir (helper)
  private async enrichPost(post: any, userId?: string) {
    const supabase = this.supabaseService.getClient();

    // Like sayısı
    const { count: likesCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);

    // Kullanıcı beğenmiş mi?
    let isLiked = false;
    if (userId) {
      const { data: like } = await supabase
        .from('likes')
        .select('*')
        .eq('post_id', post.id)
        .eq('user_id', userId)
        .single();
      
      isLiked = !!like;
    }

    return {
      ...post,
      author: post.profiles,
      likes_count: likesCount || 0,
      is_liked: isLiked,
    };
  }

  // Gönderiyi beğenenler listesi
  async getPostLikes(postId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('likes')
      .select(`
        user_id,
        created_at,
        profiles:user_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('post_id', postId);

    if (error) {
      throw new BadRequestException('Failed to fetch likes');
    }

    return data.map(like => ({
      ...like.profiles,
      liked_at: like.created_at,
    }));
  }
}