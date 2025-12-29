import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private supabaseService: SupabaseService) {}

  // Kullanıcının kendi profilini getir
  async getMyProfile(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Profile not found');
    }

    return data;
  }

  // Username ile profil getir (public)
  async getProfileByUsername(username: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      throw new NotFoundException('Profile not found');
    }

    return data;
  }

  // Profil güncelle
  async updateProfile(userId: string, updateDto: UpdateProfileDto) {
    const supabase = this.supabaseService.getClient();

    // Eğer username değiştiriliyorsa, benzersizlik kontrolü
    if (updateDto.username) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', updateDto.username)
        .neq('id', userId)
        .single();

      if (existingProfile) {
        throw new BadRequestException('Username already taken');
      }
    }

    // Profili güncelle
    const { data, error } = await supabase
      .from('profiles')
      .update(updateDto)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to update profile');
    }

    return data;
  }
}