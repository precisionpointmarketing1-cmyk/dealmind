import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { CompanySettings, DEFAULT_COMPANY } from '@/types/company'

const FILE = join(process.cwd(), 'data', 'company.json')

function load(): CompanySettings {
  try {
    return { ...DEFAULT_COMPANY, ...JSON.parse(readFileSync(FILE, 'utf-8')) }
  } catch {
    return DEFAULT_COMPANY
  }
}

export async function GET() {
  return NextResponse.json(load())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const current = load()
  const updated: CompanySettings = { ...current, ...body }
  writeFileSync(FILE, JSON.stringify(updated, null, 2))
  return NextResponse.json(updated)
}
