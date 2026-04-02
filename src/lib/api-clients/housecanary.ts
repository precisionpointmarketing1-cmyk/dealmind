const BASE = 'https://api.housecanary.com'
const KEY    = process.env.HOUSECANARY_API_KEY!
const SECRET = process.env.HOUSECANARY_API_SECRET!

function authHeader(): string {
  const token = Buffer.from(`${KEY}:${SECRET}`).toString('base64')
  return `Basic ${token}`
}

async function get(path: string) {
  const url = `${BASE}${path}`
  console.log('[HouseCanary] GET', url.split('?')[0])

  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
    cache: 'no-store',
  })

  const text = await res.text()
  console.log(`[HouseCanary] ${res.status}`, text.slice(0, 200))

  if (!res.ok) throw new Error(`HouseCanary ${res.status}: ${text.slice(0, 150)}`)
  try { return JSON.parse(text) } catch { throw new Error(`HouseCanary bad JSON: ${text.slice(0, 100)}`) }
}

// ── Property AVM ──────────────────────────────────────────────────────────────
export interface HouseCanaryAVM {
  priceMean:  number   // blended AVM estimate
  priceLow:   number
  priceHigh:  number
  fsd:        number   // fractional standard deviation — lower = more confident
  confidence: 'high' | 'medium' | 'low'
}

export async function getPropertyAVM(
  address: string,
  zip: string
): Promise<HouseCanaryAVM | null> {
  try {
    const params = new URLSearchParams({ address, zipcode: zip })
    const data = await get(`/v2/property/value?${params}`)

    const result = data?.['property/value']?.result?.value
    if (!result || !result.price_mean) return null

    const fsd = result.fsd ?? 0.10
    const confidence: HouseCanaryAVM['confidence'] =
      fsd <= 0.05 ? 'high' : fsd <= 0.10 ? 'medium' : 'low'

    return {
      priceMean:  Math.round(result.price_mean),
      priceLow:   Math.round(result.price_lwr  ?? result.price_mean * 0.92),
      priceHigh:  Math.round(result.price_upr  ?? result.price_mean * 1.08),
      fsd,
      confidence,
    }
  } catch (e) {
    console.warn('[HouseCanary] getPropertyAVM failed:', e)
    return null
  }
}

// ── Rental AVM ────────────────────────────────────────────────────────────────
export interface HouseCanaryRental {
  rentalValue:     number
  rentalValueSqft: number
  rentLow:         number
  rentHigh:        number
}

export async function getRentalAVM(
  address: string,
  zip: string
): Promise<HouseCanaryRental | null> {
  try {
    const params = new URLSearchParams({ address, zipcode: zip })
    const data = await get(`/v2/property/rental_value?${params}`)

    const result = data?.['property/rental_value']?.result
    if (!result || !result.rental_value) return null

    const rv = result.rental_value
    return {
      rentalValue:     Math.round(rv),
      rentalValueSqft: result.rental_value_sqft ?? 0,
      rentLow:         Math.round(result.percentile_range?.['25th'] ?? rv * 0.90),
      rentHigh:        Math.round(result.percentile_range?.['75th'] ?? rv * 1.10),
    }
  } catch (e) {
    console.warn('[HouseCanary] getRentalAVM failed:', e)
    return null
  }
}
