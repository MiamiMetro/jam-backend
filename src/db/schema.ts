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
export const friendStatusEnum = pgEnum('friend_status', [
  'pending',
  'accepted',
]);
export const dmPrivacyEnum = pgEnum('dm_privacy', ['friends', 'everyone']);

// Profiles table
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 20 }).notNull().unique(),
  displayName: varchar('display_name', { length: 50 }),
  avatarUrl: text('avatar_url'),
  bio: varchar('bio', { length: 500 }),
  dmPrivacy: dmPrivacyEnum('dm_privacy').default('friends').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Posts table (self-referential - comments are posts with parent_id)
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    parentId: uuid('parent_id').references((): any => posts.id, {
      onDelete: 'cascade',
    }),
    text: varchar('text', { length: 1000 }),
    audioUrl: text('audio_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('posts_author_id_idx').on(table.authorId),
    index('posts_parent_id_idx').on(table.parentId),
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

// Friends table
export const friends = pgTable(
  'friends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    friendId: uuid('friend_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    status: friendStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('friends_user_friend_unique').on(table.userId, table.friendId),
    index('friends_user_id_idx').on(table.userId),
    index('friends_friend_id_idx').on(table.friendId),
    index('friends_status_idx').on(table.status),
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
    text: varchar('text', { length: 1000 }),
    audioUrl: text('audio_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_created_at_idx').on(table.createdAt),
  ]
);
