import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BlocksService {
  constructor(private supabaseService: SupabaseService) {}

  // Kullanıcıyı engelle
  async blockUser(blockerId: string, blockedId: string) {
    const supabase = this.supabaseService.getClient();

    // Kendini engelleyemez
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    // Zaten engellenmiş mi kontrol et
    const { data: existingBlock } = await supabase
      .from('blocks')
      .select('*')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .single();

    if (existingBlock) {
      throw new BadRequestException('User already blocked');
    }

    // Engelle
    const { data, error } = await supabase
      .from('blocks')
      .insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to block user');
    }

    return data;
  }

  // Engeli kaldır
  async unblockUser(blockerId: string, blockedId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Block not found');
    }

    return { message: 'User unblocked successfully' };
  }

  // Engellediklerim listesi
  async getBlockedUsers(blockerId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('blocks')
      .select(`
        blocked_id,
        created_at,
        profiles:blocked_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('blocker_id', blockerId);

    if (error) {
      throw new BadRequestException('Failed to fetch blocked users');
    }

    // Profil bilgilerini düzenle
    return data.map((block) => ({
      ...block.profiles,
      blocked_at: block.created_at,
    }));
  }

  // İki kullanıcı arasında engel var mı kontrol et (helper fonksiyon)
  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('blocks')
      .select('*')
      .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
      .single();

    return !!data;
  }
}