import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle/content',
  schema: ['./src/db/content/schema.ts'],
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.CONTENT_DB_FILE_NAME! // e.g. "content.db"
  }
})
