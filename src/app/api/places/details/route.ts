import { NextRequest, NextResponse } from 'next/server'

// Nominatim place lookup by OSM place_id
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id')
  if (!placeId) return NextResponse.json({}, { status: 400 })

  const res = await fetch(
    `https://nominatim.openstreetmap.org/lookup?osm_ids=N${placeId},W${placeId},R${placeId}&format=json&addressdetails=1`,
    {
      headers: { 'User-Agent': 'DealMindAI/1.0 (real-estate-tool)' },
      cache: 'no-store',
    }
  )
  const data = await res.json()
  return NextResponse.json(data[0] ?? {})
}
