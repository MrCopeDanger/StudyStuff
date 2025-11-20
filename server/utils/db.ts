import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Resolve the database path robustly. The DB is stored in `nuxt-app/problems.sqlite`.
// However this file may be opened from different CWDs (repo root or inside nuxt-app).
// Try the most likely locations and pick the first that exists; otherwise create
// the parent directory for the preferred location.
// Determine a safe __dirname in ES module context and allow an env override
// (DB_PATH) so callers can point the server at a different file when needed.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Prefer the DB located at nuxt-app/problems.sqlite relative to this file
// but allow overriding with DB_PATH env var (absolute or relative path).
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '..', '..', 'problems.sqlite')

// Ensure parent directory exists
const parentDir = path.dirname(dbPath)
if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true })

const db = (() => {
  try {
    return new Database(dbPath)
  } catch (err) {
    throw new Error(`Failed to open SQLite DB at ${dbPath}: ${String(err)}`)
  }
})()

export default db
