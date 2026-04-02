import { createHmac, randomBytes } from 'crypto'
import { cookies } from 'next/headers'

const SECRET = process.env.AUTH_SECRET ?? 'dealmind-secret'
const COOKIE = 'dm_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function sign(token: string): string {
  return createHmac('sha256', SECRET).update(token).digest('hex')
}

export function createSession(): string {
  const token = randomBytes(32).toString('hex')
  return `${token}.${sign(token)}`
}

export function verifySession(value: string): boolean {
  const [token, sig] = value.split('.')
  if (!token || !sig) return false
  return sign(token) === sig
}

export async function getSession(): Promise<boolean> {
  const store = await cookies()
  const val = store.get(COOKIE)?.value
  if (!val) return false
  return verifySession(val)
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
