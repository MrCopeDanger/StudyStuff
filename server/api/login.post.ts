// server/api/login.post.ts
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '~~/src/db/auth/index'
import { accountsTable } from '~~/src/db/auth/schema'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { createError, readBody } from 'h3'
import { createSession } from '~~/server/api/lib/session'

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional().default(false)
})

export default defineEventHandler(async (event: H3Event) => {
  const body = BodySchema.parse(await readBody(event))

  const [user] = await db
    .select({
      id: accountsTable.id,
      email: accountsTable.email,
      username: accountsTable.username,
      name: accountsTable.name,
      passwordHash: accountsTable.password_hash
    })
    .from(accountsTable)
    .where(eq(accountsTable.email, body.email))
    .limit(1)

  // Unified error to avoid user enumeration
  const invalidErr = () => createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  if (!user) throw invalidErr()

  const ok = await bcrypt.compare(body.password, user.passwordHash)
  if (!ok) throw invalidErr()

  await createSession(event, user.id, body.remember)

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name
  }
})
