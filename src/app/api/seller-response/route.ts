import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Resend } from 'resend'

const FILE = join(process.cwd(), 'data', 'seller-responses.json')
const resend = new Resend(process.env.RESEND_API_KEY)

function load(): SellerResponseRecord[] {
  try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch { return [] }
}
function save(data: SellerResponseRecord[]) {
  writeFileSync(FILE, JSON.stringify(data, null, 2))
}

export interface SellerResponseRecord {
  token: string
  address: string
  offerAmt: number
  sellerName?: string
  createdAt: string
  status: 'pending' | 'accepted' | 'declined'
  respondedAt?: string
  dealSnapshot?: unknown
  sentByUserId?: string
  sentByEmail?: string
  sentByName?: string
}

function cur(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

async function sendAcceptanceNotification(record: SellerResponseRecord) {
  if (!record.sentByEmail) return
  const from = process.env.EMAIL_FROM ?? 'noreply@housebuyerstexas.net'
  try {
    await resend.emails.send({
      from,
      to: record.sentByEmail,
      subject: `🎉 Seller Accepted — ${record.address}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0b0f1e;color:#e2e8f0;border-radius:12px;">
          <h1 style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:4px;">Seller Accepted Your Offer</h1>
          <p style="color:#94a3b8;font-size:14px;margin:4px 0 24px;">
            ${record.sellerName ? `<strong style="color:#fff;">${record.sellerName}</strong> has accepted` : 'The seller has accepted'} your cash offer.
          </p>
          <div style="background:#1e293b;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">Property</p>
            <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#ffffff;">${record.address}</p>
            <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">Accepted Offer</p>
            <p style="margin:0;font-size:22px;font-weight:700;color:#10b981;">${cur(record.offerAmt)}</p>
          </div>
          <p style="font-size:13px;color:#64748b;margin-top:20px;">
            Responded ${new Date(record.respondedAt ?? '').toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      `,
    })
  } catch {
    // Non-fatal
  }
}

// GET /api/seller-response?token=xxx
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
  const record = load().find(r => r.token === token)
  if (!record) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(record)
}

// POST /api/seller-response — create a new record (called when generating seller PDF)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, address, offerAmt, sellerName, dealSnapshot, sentByUserId, sentByEmail, sentByName } = body
  if (!token || !address) return NextResponse.json({ error: 'token and address required' }, { status: 400 })
  const records = load()
  const existing = records.findIndex(r => r.token === token)
  const record: SellerResponseRecord = {
    token, address, offerAmt, sellerName,
    createdAt: new Date().toISOString(),
    status: 'pending',
    dealSnapshot,
    sentByUserId,
    sentByEmail,
    sentByName,
  }
  if (existing >= 0) records[existing] = record
  else records.push(record)
  save(records)
  return NextResponse.json({ success: true })
}

// PATCH /api/seller-response?token=xxx&action=accepted|declined
export async function PATCH(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const action = req.nextUrl.searchParams.get('action') as 'accepted' | 'declined'
  if (!token || !action) return NextResponse.json({ error: 'token and action required' }, { status: 400 })
  const records = load()
  const idx = records.findIndex(r => r.token === token)
  if (idx < 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  records[idx].status = action
  records[idx].respondedAt = new Date().toISOString()
  save(records)

  // Notify the team member who sent the offer — only on acceptance
  if (action === 'accepted') {
    sendAcceptanceNotification(records[idx])
  }

  return NextResponse.json({ success: true, status: action })
}
