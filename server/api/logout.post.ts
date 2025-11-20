// server/api/logout.post.ts
import { destroySessionByToken } from '~~/server/api/lib/session'

export default defineEventHandler(async (event) => {
  await destroySessionByToken(event)
  return { ok: true }
})
