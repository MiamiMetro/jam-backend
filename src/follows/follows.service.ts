import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FollowsService {
  constructor(private supabaseService: SupabaseService) {}

  // Kullanıcıyı takip et
  async followUser(followerId: string, followingId: string) {
    const supabase = this.supabaseService.getClient();

    // Kendini takip edemez
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Zaten takip ediyor mu kontrol et
    const { data: existingFollow } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    if (existingFollow) {
      throw new BadRequestException('Already following this user');
    }

    // Takip et
    const { data, error } = await supabase
      .from('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to follow user');
    }

    return data;
  }

  // Takibi bırak
  async unfollowUser(followerId: string, followingId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Follow relationship not found');
    }

    return { message: 'Successfully unfollowed user' };
  }

  // Takip ettiklerim (ben kimi takip ediyorum)
  async getFollowing(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('follows')
      .select(`
        following_id,
        created_at,
        profiles:following_id (
          id,
          username,
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq('follower_id', userId);

    if (error) {
      throw new BadRequestException('Failed to fetch following list');
    }

    return data.map((follow) => ({
      ...follow.profiles,
      followed_at: follow.created_at,
    }));
  }

  // Takipçilerim (beni kim takip ediyor)
  async getFollowers(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('follows')
      .select(`
        follower_id,
        created_at,
        profiles:follower_id (
          id,
          username,
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq('following_id', userId);

    if (error) {
      throw new BadRequestException('Failed to fetch followers list');
    }

    return data.map((follow) => ({
      ...follow.profiles,
      followed_at: follow.created_at,
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
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    return !!data;
  }
}