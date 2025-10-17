import { db } from '../../../lib/db'
import { users } from '../../../drizzle/schema'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  const { email, username, password } = await readBody(event)

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const newUser = await db.insert(users).values({
      id: nanoid(),
      email,
      username,
      passwordHash
    }).returning()

    return {
      success: true,
      user: {
        id: newUser[0].id,
        username: newUser[0].username,
        email: newUser[0].email
      }
    }
  } catch (error) {
    console.error('Registration error:', error) // Now we're using the error

    throw createError({
      statusCode: 400,
      statusMessage: 'Email or username already exists'
    })
  }
})
