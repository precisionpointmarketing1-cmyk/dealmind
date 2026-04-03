import { createHmac, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { findUserById } from '@/lib/users'

const SECRET = process.env.AUTH_SECRET ?? 'dealmind-secret'
const COOKIE = 'dm_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

/** Creates a signed session token embedding the userId */
export function createSession(userId: string): string {
  const token = randomBytes(32).toString('hex')
  const payload = `${userId}:${token}`
  return `${payload}.${sign(payload)}`
}

/** Verifies signature and returns userId, or null if invalid */
export function verifySession(value: string): string | null {
  const lastDot = value.lastIndexOf('.')
  if (lastDot === -1) return null
  const payload = value.slice(0, lastDot)
  const sig = value.slice(lastDot + 1)
  if (sign(payload) !== sig) return null
  const colonIdx = payload.indexOf(':')
  if (colonIdx === -1) return null
  return payload.slice(0, colonIdx)
}

export interface SessionUser {
  userId: string
  isAdmin: boolean
}

/** Server-side: reads cookie and returns session user, or null */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const val = store.get(COOKIE)?.value
  if (!val) return null
  const userId = verifySession(val)
  if (!userId) return null
  const user = findUserById(userId)
  if (!user) return null
  return { userId: user.id, isAdmin: user.role === 'admin' }
}

export function sessionCookieOptions(value: string) {
  return {
    name: COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE,
  }
}

export function clearCookieOptions() {
  return {
    name: COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}
