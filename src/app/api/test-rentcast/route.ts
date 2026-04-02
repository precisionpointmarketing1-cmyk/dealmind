import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://api.rentcast.io/v1'
const KEY = process.env.RENTCAST_API_KEY!

async function rc(path: string) {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    headers: { 'X-Api-Key': KEY, 'Accept': 'application/json' },
    cache: 'no-store',
  })
  let body: any
  try { body = await res.json() } catch { body = await res.text() }
  return { status: res.status, url, body }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const addr = searchParams.get('address') || '17614 Heritage Bay Drive, Missouri City, TX 77598'

  return NextResponse.json({
    apiKey: KEY ? `${KEY.slice(0, 8)}...` : 'MISSING',
    testedAddress: addr,
    properties:  await rc(`/properties?address=${encodeURIComponent(addr)}`),
    rentAVM:     await rc(`/avm/rent/long-term?address=${encodeURIComponent(addr)}&bedrooms=4&bathrooms=2`),
    saleAVM:     await rc(`/avm/value?address=${encodeURIComponent(addr)}&bedrooms=4`),
    markets:     await rc(`/markets?zipCode=77598`),
  })
}
