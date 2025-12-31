import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private connection: postgres.Sql;
  public db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Get database URL from environment
    // Supabase provides a connection string in the format:
    // postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
    const databaseUrl =
      this.configService.get<string>('DATABASE_URL') ||
      this.configService.get<string>('SUPABASE_DB_URL');

    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL or SUPABASE_DB_URL must be set in environment variables'
      );
    }

    // Create postgres connection
    this.connection = postgres(databaseUrl, { max: 1 });

    // Create drizzle instance
    this.db = drizzle(this.connection, { schema });

    console.log('✅ Drizzle database connected!');
  }

  async onModuleDestroy() {
    await this.connection.end();
  }
}
