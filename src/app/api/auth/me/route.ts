import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { findUserById, toPublicUser } from '@/lib/users'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = findUserById(session.userId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json(toPublicUser(user))
}
