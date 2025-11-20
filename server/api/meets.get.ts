import { db } from '~~/src/db/auth/index'
import { meetsTable } from '~~/src/db/auth/schema'
import { lt, sql } from 'drizzle-orm'

export default async function main() {
  // Delete meets whose endTime (ISO TEXT, UTC) is in the past (UTC)
  const res = await db
    .delete(meetsTable)
    .where(lt(sql`datetime(${meetsTable.endTime})`, sql`CURRENT_TIMESTAMP`))

  const meets = await db.select().from(meetsTable)
  console.log('Deleted expired meets:', res)
  console.log('Remaining rooms:', meets)
  return meets
}
