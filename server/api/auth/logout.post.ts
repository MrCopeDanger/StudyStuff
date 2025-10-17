import { db } from '../../../lib/db'
import { sessions } from '../../../drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // Get session from cookie
    const sessionId = getCookie(event, 'session')

    if (sessionId) {
      // Delete session from database
      await db.delete(sessions).where(eq(sessions.id, sessionId))
    }

    // Clear cookie
    deleteCookie(event, 'session')

    return { success: true, message: 'Logged out successfully' }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Logout error:', errorMessage)

    throw createError({
      statusCode: 500,
      statusMessage: 'Logout failed'
    })
  }
})
