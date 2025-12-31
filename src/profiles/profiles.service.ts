import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { profiles } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private dbService: DbService) {}

  // Kullanıcının kendi profilini getir
  async getMyProfile(userId: string) {
    const [profile] = await this.dbService.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      id: profile.id,
      username: profile.username,
      display_name: profile.displayName || '',
      avatar_url: profile.avatarUrl || '',
      bio: profile.bio || '',
      created_at: profile.createdAt.toISOString(),
    };
  }

  // Username ile profil getir (public)
  async getProfileByUsername(username: string) {
    const [profile] = await this.dbService.db
      .select()
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      id: profile.id,
      username: profile.username,
      display_name: profile.displayName || '',
      avatar_url: profile.avatarUrl || '',
      bio: profile.bio || '',
      created_at: profile.createdAt.toISOString(),
    };
  }

  // Profil güncelle
  async updateProfile(userId: string, updateDto: UpdateProfileDto) {
    // Eğer username değiştiriliyorsa, benzersizlik kontrolü
    if (updateDto.username) {
      const [existingProfile] = await this.dbService.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(
          and(
            eq(profiles.username, updateDto.username),
            ne(profiles.id, userId)
          )
        )
        .limit(1);

      if (existingProfile) {
        throw new BadRequestException('Username already taken');
      }
    }

    // Update data object
    const updateData: any = {
      updatedAt: new Date(),
    };
    if (updateDto.username !== undefined)
      updateData.username = updateDto.username;
    if (updateDto.display_name !== undefined)
      updateData.displayName = updateDto.display_name;
    if (updateDto.avatar_url !== undefined)
      updateData.avatarUrl = updateDto.avatar_url;
    if (updateDto.bio !== undefined) updateData.bio = updateDto.bio;

    // Profili güncelle
    const [updatedProfile] = await this.dbService.db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, userId))
      .returning();

    if (!updatedProfile) {
      throw new BadRequestException('Failed to update profile');
    }

    return {
      id: updatedProfile.id,
      username: updatedProfile.username,
      display_name: updatedProfile.displayName || '',
      avatar_url: updatedProfile.avatarUrl || '',
      bio: updatedProfile.bio || '',
      created_at: updatedProfile.createdAt.toISOString(),
    };
  }
}
