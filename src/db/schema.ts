import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const visibilityEnum = pgEnum('visibility', ['public', 'followers']);

// Profiles table
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 20 }).notNull().unique(),
  displayName: varchar('display_name', { length: 50 }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Posts table
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    text: text('text'),
    audioUrl: text('audio_url'),
    visibility: visibilityEnum('visibility').default('public').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('posts_author_id_idx').on(table.authorId),
    index('posts_created_at_idx').on(table.createdAt),
  ]
);

// Likes table
export const likes = pgTable(
  'likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('likes_post_user_unique').on(table.postId, table.userId),
    index('likes_post_id_idx').on(table.postId),
  ]
);

// Follows table
export const follows = pgTable(
  'follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: uuid('follower_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    followingId: uuid('following_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('follows_follower_following_unique').on(
      table.followerId,
      table.followingId
    ),
    index('follows_follower_id_idx').on(table.followerId),
    index('follows_following_id_idx').on(table.followingId),
  ]
);

// Blocks table
export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockerId: uuid('blocker_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    blockedId: uuid('blocked_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('blocks_blocker_blocked_unique').on(
      table.blockerId,
      table.blockedId
    ),
    index('blocks_blocker_id_idx').on(table.blockerId),
  ]
);

// Conversations table
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user1: uuid('user_1')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    user2: uuid('user_2')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('conversations_users_unique').on(table.user1, table.user2),
    index('conversations_user_1_idx').on(table.user1),
    index('conversations_user_2_idx').on(table.user2),
  ]
);

// Messages table
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: uuid('sender_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    text: text('text'),
    audioUrl: text('audio_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_created_at_idx').on(table.createdAt),
  ]
);
