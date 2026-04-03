import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getSession } from '@/lib/auth'

const DATA_FILE = path.join(process.cwd(), 'data', 'deals.json')

function readDeals(): any[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return []
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeDeals(deals: any[]) {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(deals, null, 2))
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const all = readDeals()
  // Admins see all deals; members see only their own
  const deals = session.isAdmin ? all : all.filter((d: any) => d.userId === session.userId)
  return NextResponse.json(deals)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deal = await req.json()
  const deals = readDeals()

  const idx = deals.findIndex((d: any) => d.id === deal.id)
  if (idx >= 0) {
    // Only owner or admin can update
    if (deals[idx].userId && deals[idx].userId !== session.userId && !session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    deals[idx] = { ...deal, userId: deals[idx].userId ?? session.userId }
  } else {
    deals.unshift({ ...deal, userId: session.userId })
  }

  writeDeals(deals)
  return NextResponse.json(deal)
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const deals = readDeals()
  const deal = deals.find((d: any) => d.id === id)

  if (deal && deal.userId && deal.userId !== session.userId && !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  writeDeals(deals.filter((d: any) => d.id !== id))
  return NextResponse.json({ ok: true })
}
