import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

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
  return NextResponse.json(readDeals())
}

export async function POST(req: NextRequest) {
  const deal = await req.json()
  const deals = readDeals()
  // Update if exists, otherwise prepend
  const idx = deals.findIndex((d: any) => d.id === deal.id)
  if (idx >= 0) {
    deals[idx] = deal
  } else {
    deals.unshift(deal)
  }
  writeDeals(deals)
  return NextResponse.json(deal)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const deals = readDeals().filter((d: any) => d.id !== id)
  writeDeals(deals)
  return NextResponse.json({ ok: true })
}
