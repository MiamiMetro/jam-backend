import { Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { BlocksController } from './blocks.controller';

@Module({
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService], // Diğer modüller kullanabilsin
})
export class BlocksModule {}
