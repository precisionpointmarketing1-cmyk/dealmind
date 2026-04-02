import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get('input')
  if (!input || input.length < 2) return NextResponse.json({ predictions: [] })

  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) return NextResponse.json({ predictions: [] })

  try {
    const params = new URLSearchParams({
      access_token: token,
      autocomplete:  'true',
      country:       'us',
      types:         'address',
      limit:         '7',
      language:      'en',
    })

    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input)}.json?${params}`,
      { signal: AbortSignal.timeout(6000) }
    )

    if (!res.ok) return NextResponse.json({ predictions: [] })

    const data = await res.json()
    const features: any[] = data.features ?? []

    const predictions = features.map((f: any) => {
      const houseNum = f.address ?? ''
      const streetName = f.text ?? ''
      const street = [houseNum, streetName].filter(Boolean).join(' ')

      // Extract city, state, zip from context array
      let city = '', state = '', zip = ''
      for (const ctx of (f.context ?? [])) {
        if (ctx.id.startsWith('postcode.')) zip = ctx.text
        else if (ctx.id.startsWith('place.'))   city = ctx.text
        else if (ctx.id.startsWith('region.'))  state = (ctx.short_code ?? '').replace('US-', '')
      }

      const [lng, lat] = f.center ?? []

      const parts = [street, city, state, zip].filter(Boolean)
      const description = parts.join(', ')

      return {
        place_id:    f.id,
        description,
        _raw: { street, city, state, zip, lat: String(lat), lng: String(lng) },
      }
    }).filter((p: any) => p._raw.street && p._raw.zip)

    return NextResponse.json({ predictions })
  } catch {
    return NextResponse.json({ predictions: [] })
  }
}
