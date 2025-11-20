// server/lib/session.ts
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from '~~/src/db/auth/index'
import { sessionsTable, accountsTable } from '~~/src/db/auth/schema'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { setCookie, getCookie, deleteCookie, getHeader } from 'h3'

const SESSION_COOKIE = 'sid'
const SALT_ROUNDS = 12

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex') // 64 hex chars
}

export async function hashToken(token: string) {
  return bcrypt.hash(token, SALT_ROUNDS)
}

export async function verifyToken(token: string, tokenHash: string) {
  return bcrypt.compare(token, tokenHash)
}

export function nowSec() {
  return Math.floor(Date.now() / 1000)
}

export function plusDays(days: number) {
  return nowSec() + days * 24 * 60 * 60
}

export function setSessionCookie(event: H3Event, token: string, maxAgeDays: number) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeDays * 24 * 60 * 60
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export async function createSession(event: H3Event, userId: number, remember = false) {
  const token = randomToken() // store plaintext only in cookie
  const tokenHash = await hashToken(token)
  const days = remember ? 30 : 1 // adjust as needed
  const expiresAt = plusDays(days)

  const ua = getHeader(event, 'user-agent') ?? undefined
  const ip = event.node.req.socket.remoteAddress ?? undefined

  await db.insert(sessionsTable).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    userAgent: ua,
    ip
  })

  setSessionCookie(event, token, days)
  return { token, expiresAt }
}

export async function readSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  // Fetch all sessions and check token by bcrypt compare (or store a short hash selector to narrow)
  const now = nowSec()
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.expiresAt, sessionsTable.expiresAt)) // dummy to make ts happy; we’ll filter in code

  for (const s of sessions) {
    if (s.expiresAt <= now) continue
    const ok = await verifyToken(token, s.tokenHash)
    if (ok) {
      return s
    }
  }
  return null
}

export async function getCurrentUser(event: H3Event) {
  const session = await readSession(event)
  if (!session) return null
  const [user] = await db
    .select({
      id: accountsTable.id,
      email: accountsTable.email,
      username: accountsTable.username,
      name: accountsTable.name,
      avatar: accountsTable.avatar
    })
    .from(accountsTable)
    .where(eq(accountsTable.id, session.userId))
    .limit(1)
  return user ?? null
}

export async function destroySessionByToken(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return
  // load all sessions and delete the matching one
  const sessions = await db.select().from(sessionsTable)
  for (const s of sessions) {
    if (await verifyToken(token, s.tokenHash)) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, s.id))
      break
    }
  }
  clearSessionCookie(event)
}
