import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private connection: postgres.Sql;
  public db: ReturnType<typeof drizzle<typeof schema>>;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  get connected(): boolean {
    return this.isConnected;
  }

  async onModuleInit() {
    // Get database URL from environment
    // Supabase provides a connection string in the format:
    // postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
    const databaseUrl =
      this.configService.get<string>('DATABASE_URL') ||
      this.configService.get<string>('SUPABASE_DB_URL');

    if (!databaseUrl) {
      console.warn(
        '⚠️ DATABASE_URL or SUPABASE_DB_URL not set - Drizzle queries will fail'
      );
      return;
    }

    try {
      console.log('🔌 Attempting to connect to database...');
      // Create postgres connection with timeout
      // Increased max connections to allow concurrent queries
      this.connection = postgres(databaseUrl, {
        max: 10,
        connect_timeout: 5,
        idle_timeout: 20,
        max_lifetime: 60 * 30, // 30 minutes
      });

      // Create drizzle instance
      this.db = drizzle(this.connection, { schema });

      // Test connection with timeout
      const testPromise = this.connection`SELECT 1`;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection test timeout')), 5000)
      );

      await Promise.race([testPromise, timeoutPromise]);
      this.isConnected = true;
      console.log('✅ Drizzle database connected!');
    } catch (error: any) {
      console.error(
        '❌ Failed to connect to database:',
        error?.message || error
      );
      this.isConnected = false;
      // Don't throw - allow app to start but queries will fail gracefully
    }
  }

  async onModuleDestroy() {
    await this.connection.end();
  }
}
