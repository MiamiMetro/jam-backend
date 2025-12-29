import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('❌ Supabase URL or Service Role Key is missing in .env');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase connected!');
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}