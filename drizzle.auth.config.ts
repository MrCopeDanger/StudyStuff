import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle/auth',
  schema: ['./src/db/auth/schema.ts'],
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.AUTH_DB_FILE_NAME! // e.g. "auth.db"
  }
})
