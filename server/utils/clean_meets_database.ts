// call this function when loading the list of rooms
import { db } from '~~/src/db/auth/index'
import { meetsTable } from '~~/src/db/auth/schema'
import { sql } from 'drizzle-orm'

await db.delete(meetsTable).where(sql`${meetsTable.endTime} < CURRENT_TIMESTAMP`)
