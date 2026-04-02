import { NextRequest, NextResponse } from 'next/server'
import { createSession, sessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const session = createSession()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(session))
  return res
}
