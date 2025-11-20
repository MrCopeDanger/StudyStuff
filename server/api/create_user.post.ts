// import { readMultipartFormData } from 'h3'
// import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { lower, accountsTable } from '~~/src/db/auth/schema'
import { db } from '~~/src/db/auth/index'
import { eq } from 'drizzle-orm'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  // dont worry abt this syntax error ↑
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

export default defineEventHandler(async (event) => {
  // 1. Read multipart form data
  const formData = await readFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  // Extract fields
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username') as string
  const name = formData.get('name') as string
  const avatarFile = formData.get('avatar') as File

  // 3. Validate fields (excluding avatar)
  // const body = BodySchema

  // 4. Check for existing user
  const existing = await db
    .select()
    .from(accountsTable)
    .where(eq(lower(accountsTable.email), email.toLowerCase()))
  if (existing.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input'
    })
  }

  // 5. Hash password
  const saltRounds = 12
  const password_hash = await bcrypt.hash(password, saltRounds)
  console.log(avatarFile)
  // 6. Upload avatar to S3
  let avatarUrl = null
  if (avatarFile) {
    try {
    // Convert File to Buffer
      const arrayBuffer = await avatarFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const fileName = `${username}-${Date.now()}.${avatarFile.type.split('/')[1]}`

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `avatars/${fileName}`,
        Body: buffer, // Use buffer instead of avatarFile
        ContentType: avatarFile.type,
        ContentLength: buffer.length // Explicitly set length
      })

      await s3Client.send(command)
      avatarUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/avatars/${fileName}`
    } catch (error) {
      console.error('S3 upload error:', error)
      throw createError({ statusCode: 500, statusMessage: 'Failed to upload avatar' })
    }
  }

  // 7. Insert into database
  await db.insert(accountsTable).values({
    name: name,
    username: username,
    email: email,
    password_hash: password_hash,
    avatar: avatarUrl
  })
})
