import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSession } from '@/lib/auth'
import { readUsers, createUser, deleteUser, updateUserPassword, toPublicUser } from '@/lib/users'

const resend = new Resend(process.env.RESEND_API_KEY)

async function requireAdmin() {
  const session = await getSession()
  if (!session?.isAdmin) return null
  return session
}

async function sendWelcomeEmail(name: string, email: string, password: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:8080'
  const from = process.env.EMAIL_FROM ?? 'noreply@housebuyerstexas.net'
  try {
    await resend.emails.send({
      from,
      to: email,
      subject: "You've been added to DealMind AI",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0b0f1e;color:#e2e8f0;border-radius:12px;">
          <h1 style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:4px;">Welcome to DealMind AI</h1>
          <p style="color:#94a3b8;font-size:14px;margin-top:0 0 24px;">Hi ${name}, your account has been created. Here are your login details:</p>
          <div style="background:#1e293b;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Login URL</p>
            <a href="${appUrl}/login" style="color:#00c8ff;font-size:14px;font-weight:600;">${appUrl}/login</a>
            <p style="margin:16px 0 8px;font-size:13px;color:#94a3b8;">Email</p>
            <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;">${email}</p>
            <p style="margin:16px 0 8px;font-size:13px;color:#94a3b8;">Temporary Password</p>
            <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;font-family:monospace;">${password}</p>
          </div>
          <p style="font-size:12px;color:#64748b;margin-top:24px;">Please change your password after logging in for the first time.</p>
        </div>
      `,
    })
  } catch {
    // Non-fatal — account is created regardless
  }
}

export async function GET() {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(readUsers().map(toPublicUser))
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { name, email, password, role } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }
  try {
    const user = createUser(name, email, password, role === 'admin' ? 'admin' : 'member')
    // Fire-and-forget welcome email
    sendWelcomeEmail(name, email, password)
    return NextResponse.json(toPublicUser(user))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id, newPassword } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (id === session.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  if (newPassword) {
    updateUserPassword(id, newPassword)
    return NextResponse.json({ ok: true })
  }

  deleteUser(id)
  return NextResponse.json({ ok: true })
}
