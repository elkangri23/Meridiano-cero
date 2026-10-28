import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  localKey: text('local_key').notNull().unique(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('player'),
});
export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id),
  csrfToken: text('csrf_token').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
