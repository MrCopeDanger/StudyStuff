import { sqliteTable, text, int, blob } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const booksTable = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  edition: text('edition'),
  sourceUrl: text('source_url'),
  createdAt: int('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
})

export const textbookChunksTable = sqliteTable('textbook_chunks', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => booksTable.id),

  chapterNumber: int('chapter_number'),
  chapterTitle: text('chapter_title'),
  sectionNumber: text('section_number'),
  sectionTitle: text('section_title'),
  pages: text('pages'),

  topicPath: text('topic_path'),

  level: text('level'),
  difficulty: int('difficulty'),

  orderInSection: int('order_in_section'),
  text: text('text').notNull(),

  createdAt: int('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
})

export const chunkEmbeddingsTable = sqliteTable('chunk_embeddings', {
  chunkId: text('chunk_id')
    .primaryKey()
    .references(() => textbookChunksTable.id),

  embedding: blob('embedding', { mode: 'buffer' }).notNull(),
  model: text('model'),
  dim: int('dim'),

  createdAt: int('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
})
