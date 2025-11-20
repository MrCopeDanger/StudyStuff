import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('content.db') // separate file
export const dbContent = drizzle(sqlite, { schema })

export * from './schema'
