import { NextRequest, NextResponse } from 'next/server'
import { createSession, sessionCookieOptions } from '@/lib/auth'
import { ensureAdminUser, findUserByEmail, verifyPassword } from '@/lib/users'

export async function POST(req: NextRequest) {
  ensureAdminUser()

  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const user = findUserByEmail(email)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const session = createSession(user.id)
  const res = NextResponse.json({ ok: true, name: user.name, role: user.role })
  res.cookies.set(sessionCookieOptions(session))
  return res
}
