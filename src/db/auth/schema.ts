import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { int, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export function lower(email: AnySQLiteColumn) {
  return sql`lower(${email})`
}

export const accountsTable = sqliteTable('accounts_table', {
  id: int().primaryKey({ autoIncrement: true }).unique(),
  email: text().notNull().unique(),
  username: text().notNull().unique(),
  name: text().notNull(),
  password_hash: text().notNull().unique(),
  avatar: text()
}, table => [
  uniqueIndex('email_idx').on(table.email)
])

export const sessionsTable = sqliteTable('sessions', {
  id: text('id').primaryKey(), // random 128-bit hex or base64url
  userId: int('user_id').notNull().references(() => accountsTable.id),
  // Hash the token so DB theft doesn’t give instant access
  tokenHash: text('token_hash').notNull(),
  // for rotation and single-session if you want
  sessionVersion: int('session_version').notNull().default(1),
  // expiry in unix seconds
  expiresAt: int('expires_at').notNull(),
  createdAt: int('created_at').notNull().default(sql`(strftime('%s','now'))`),
  lastUsedAt: int('last_used_at').notNull().default(sql`(strftime('%s','now'))`),
  userAgent: text('user_agent'),
  ip: text('ip')
})

export const meetsTable = sqliteTable('meets', {
  id: int().primaryKey({ autoIncrement: true }).unique(),
  name: text(),
  description: text(),
  startTime: text(),
  endTime: text(),
  link: text()
})

export const userUploadTable = sqliteTable('user_uploads', {
  id: int().primaryKey({ autoIncrement: true }).unique(),
  userId: int('user_id').notNull().references(() => accountsTable.id),
  name: text(),
  description: text(),
  createdAt: int('created_at').notNull().default(sql`(strftime('%s','now'))`),
  file: text(), // AWS s3 file path
  tags: text() // Formatted as an array
})
