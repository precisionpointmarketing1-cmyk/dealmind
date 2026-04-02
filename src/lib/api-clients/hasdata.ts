const BASE = 'https://api.hasdata.com/scrape'

function key() {
  return process.env.HASDATA_API_KEY ?? ''
}

function headers() {
  return { 'x-api-key': key() }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AirbnbMarketData {
  averageNightlyRate: number
  medianNightlyRate: number
  sampleCount: number
  estimatedOccupancy: number
  priceRange: { low: number; high: number }
  source: 'hasdata'
}

export interface ZillowCompData {
  zillowAvgPrice: number    // price-per-sqft × subject sqft
  zillowMedianPrice: number
  sampleCount: number
  pricePerSqft: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, '')) || 0
  return 0
}

function extractAirbnbPrice(listing: any): number {
  // HasData may nest price in various ways
  const raw =
    listing?.price?.amount ??
    listing?.price?.rate ??
    listing?.price?.value ??
    listing?.pricing?.price ??
    listing?.nightlyPrice ??
    listing?.pricePerNight ??
    listing?.rate ??
    listing?.price ??
    0
  const n = parsePrice(raw)
  return n > 20 && n < 5000 ? n : 0
}

function extractListings(data: any): any[] {
  return (
    data?.searchResults ??
    data?.results ??
    data?.listings ??
    data?.data ??
    []
  )
}

// ─── Airbnb Market Rates ─────────────────────────────────────────────────────

/**
 * Fetches current Airbnb listing prices for a market area.
 * Returns median/average nightly rate so the Airbnb strategy uses real market ADR.
 */
export async function getAirbnbMarketData(
  city: string,
  state: string,
): Promise<AirbnbMarketData | null> {
  if (!key()) return null

  // Use 2 weeks out so we get current live listings
  const checkIn  = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const checkOut = new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const params = new URLSearchParams({
    location: `${city}, ${state}`,
    checkIn,
    checkOut,
    adults: '2',
  })

  try {
    const res = await fetch(`${BASE}/airbnb/listing?${params}`, {
      headers: headers(),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null

    const data = await res.json()
    const listings = extractListings(data)
    if (!Array.isArray(listings) || listings.length === 0) return null

    const prices = listings.map(extractAirbnbPrice).filter(p => p > 0)
    if (prices.length < 3) return null

    prices.sort((a, b) => a - b)
    const avg    = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
    const mid    = Math.floor(prices.length / 2)
    const median = Math.round(prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid])
    const low    = prices[Math.floor(prices.length * 0.10)] ?? prices[0]
    const high   = prices[Math.floor(prices.length * 0.90)] ?? prices[prices.length - 1]

    return {
      averageNightlyRate: avg,
      medianNightlyRate:  median,
      sampleCount:        prices.length,
      estimatedOccupancy: 0.65,  // industry conservative default
      priceRange:         { low: Math.round(low), high: Math.round(high) },
      source:             'hasdata',
    }
  } catch {
    return null
  }
}

// ─── Zillow Sale Comps ────────────────────────────────────────────────────────

/**
 * Fetches recently-sold listings from Zillow for a zip/city area.
 * Used as an additional ARV data source alongside RentCast comps.
 */
export async function getZillowComps(
  city: string,
  state: string,
  zip: string,
  beds: number,
  sqft: number,
): Promise<ZillowCompData | null> {
  if (!key()) return null

  // Search by zip first for precision; fall back to city+state
  const keyword = zip ? zip : `${city}, ${state}`

  const params = new URLSearchParams({
    keyword,
    type: 'recentlySold',
    bedsMin: String(Math.max(1, beds - 1)),
    bedsMax: String(beds + 1),
  })

  try {
    const res = await fetch(`${BASE}/zillow/listing?${params}`, {
      headers: headers(),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null

    const data = await res.json()
    const listings = extractListings(data)
    if (!Array.isArray(listings) || listings.length === 0) return null

    type Comp = { price: number; sqft: number }
    const comps: Comp[] = listings
      .map((l: any) => {
        const price = parsePrice(
          l?.price?.value ?? l?.unformattedPrice ?? l?.soldPrice ?? l?.price
        )
        const lsqft = parsePrice(l?.livingArea ?? l?.sqft ?? l?.floorSize)
        return { price, sqft: lsqft }
      })
      .filter((c): c is Comp => c.price > 50_000 && c.price < 5_000_000)

    if (comps.length === 0) return null

    const prices = comps.map(c => c.price).sort((a, b) => a - b)
    const avg    = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
    const mid    = Math.floor(prices.length / 2)
    const median = Math.round(prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid])

    const withSqft    = comps.filter(c => c.sqft > 400)
    const avgPPSF     = withSqft.length > 0
      ? withSqft.reduce((s, c) => s + c.price / c.sqft, 0) / withSqft.length
      : 0

    // ARV for subject: use $/sqft × subject sqft when available, otherwise median
    const zillowAvgPrice = sqft > 0 && avgPPSF > 0
      ? Math.round(avgPPSF * sqft)
      : median

    return {
      zillowAvgPrice,
      zillowMedianPrice: median,
      sampleCount:       comps.length,
      pricePerSqft:      Math.round(avgPPSF),
    }
  } catch {
    return null
  }
}
