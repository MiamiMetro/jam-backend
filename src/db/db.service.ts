import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DbService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private isConnected = false;

  constructor() {
    super({
      log: ['error', 'warn'],
    });
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
  }
}
