import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * SupabaseService - Handles Supabase Authentication only
 *
 * Note: Database operations are now handled by Prisma ORM via DbService.
 * This service is kept only for Supabase Auth operations (signUp, signIn, getUser).
 */
@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY'
    );

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('❌ Supabase URL or Service Role Key is missing in .env');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase Auth connected!');
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
