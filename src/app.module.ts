import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { BlocksModule } from './blocks/blocks.module';
import { FollowsModule } from './follows/follows.module';
import { PostsModule } from './posts/posts.module';
import { MessagesModule } from './messages/messages.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    AuthModule,
    ProfilesModule,
    BlocksModule,
    FollowsModule,
    PostsModule,
    MessagesModule,
    RoomsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}