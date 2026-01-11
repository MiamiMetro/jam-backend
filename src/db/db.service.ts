import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class DbService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private isConnected = false;
  private pool: Pool;
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    // Create pg Pool
    const pool = new Pool({
      connectionString,
    });

    // Create Prisma adapter
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: ['error', 'warn'],
    });

    // Assign after super()
    this.pool = pool;
    this.configService = configService;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async onModuleInit() {
    try {
      console.log('🔌 Attempting to connect to database...');
      await this.$connect();
      this.isConnected = true;
      console.log('✅ Prisma database connected!');
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
    await this.$disconnect();
    await this.pool.end();
  }
}
