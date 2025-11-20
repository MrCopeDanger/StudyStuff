// server/api/me.get.ts
// import { useError } from 'nuxt/app'
import { getCurrentUser } from '~~/server/api/lib/session'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    // throw createError({ statusCode: 401, statusMessage: 'User Not logged in' })
    // Now Handling error client side by popping up a toast notification
    setResponseStatus(event, 401)
    return { user: null }
  }
  return { user }
})
