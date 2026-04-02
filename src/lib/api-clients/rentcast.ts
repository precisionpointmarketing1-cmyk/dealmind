import { RentCastComps, RentCastMarket, RentCastSaleComps } from '@/types/deal'

const BASE = 'https://api.rentcast.io/v1'
const KEY = process.env.RENTCAST_API_KEY!

async function get(path: string) {
  const url = `${BASE}${path}`
  console.log('[RentCast] GET', url)

  const res = await fetch(url, {
    headers: {
      'X-Api-Key': KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  const text = await res.text()
  console.log(`[RentCast] ${res.status} ${url.split('?')[0]}`, text.slice(0, 300))

  if (!res.ok) throw new Error(`RentCast ${res.status}: ${text.slice(0, 200)}`)

  try { return JSON.parse(text) } catch { throw new Error(`RentCast bad JSON: ${text.slice(0, 100)}`) }
}

// ── Property Details ──────────────────────────────────────────────────────────
export interface PropertyRecord {
  bedrooms: number
  bathrooms: number
  sqft: number
  yearBuilt: number
  propertyType: string
  units?: number
  lotSize?: number
  lastSalePrice?: number
  lastSaleDate?: string
  assessedValue?: number
  latitude?: number
  longitude?: number
}

export async function getPropertyDetails(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<PropertyRecord | null> {
  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ').trim()
  const params = new URLSearchParams({ address: fullAddress })

  try {
    const data = await get(`/properties?${params}`)

    // RentCast returns array OR single object
    const p = Array.isArray(data) ? data[0] : data
    if (!p) return null

    // Log raw keys so we can see what RentCast actually returns
    console.log('[RentCast] property keys:', Object.keys(p).join(', '))
    console.log('[RentCast] property raw:', JSON.stringify(p).slice(0, 500))

    return {
      bedrooms:      p.bedrooms      ?? p.bedroomCount  ?? 0,
      bathrooms:     p.bathrooms     ?? p.bathroomCount  ?? 0,
      sqft:          p.squareFootage ?? p.livingArea     ?? p.sqft ?? 0,
      yearBuilt:     p.yearBuilt     ?? p.year_built     ?? 0,
      propertyType:  p.propertyType  ?? p.property_type  ?? 'Single Family',
      units:         p.units         ?? p.unitCount      ?? undefined,
      lotSize:       p.lotSize       ?? p.lot_size       ?? undefined,
      lastSalePrice: p.lastSalePrice ?? p.last_sale_price ?? undefined,
      lastSaleDate:  p.lastSaleDate  ?? p.last_sale_date  ?? undefined,
      assessedValue: p.assessedValue ?? p.assessed_value  ?? undefined,
      latitude:      p.latitude      ?? p.lat            ?? undefined,
      longitude:     p.longitude     ?? p.lon            ?? p.lng ?? undefined,
    }
  } catch (e) {
    console.warn('[RentCast] getPropertyDetails failed:', e)
    return null
  }
}

export function mapPropertyType(rcType: string): string {
  const t = (rcType ?? '').toLowerCase()
  if (t.includes('multi') || t.includes('duplex') || t.includes('triplex') || t.includes('quadplex')) return 'multi-family'
  if (t.includes('condo') || t.includes('apartment')) return 'condo'
  if (t.includes('townhouse') || t.includes('townhome')) return 'townhouse'
  if (t.includes('land') || t.includes('lot')) return 'land'
  return 'single-family'
}

// ── Rent AVM ──────────────────────────────────────────────────────────────────
export async function getRentComps(
  address: string,
  city: string,
  state: string,
  zip: string,
  bedrooms: number,
  bathrooms: number
): Promise<RentCastComps> {
  const fullAddress = `${address}, ${city}, ${state} ${zip}`
  const params = new URLSearchParams({
    address: fullAddress,
    bedrooms: String(Math.max(1, bedrooms || 3)),
    bathrooms: String(Math.max(1, bathrooms || 2)),
    limit: '10',
  })

  const data = await get(`/avm/rent/long-term?${params}`)

  const comps = (data.listings ?? []).map((c: any) => ({
    address:    c.formattedAddress ?? '',
    bedrooms:   c.bedrooms ?? 0,
    bathrooms:  c.bathrooms ?? 0,
    sqft:       c.squareFootage ?? 0,
    rent:       c.price ?? 0,
    distance:   c.distance ?? 0,
    listedDate: c.listedDate ?? '',
  }))

  return {
    rentLow:     data.rentRangeLow  ?? 0,
    rentHigh:    data.rentRangeHigh ?? 0,
    rentAvg:     data.rent          ?? 0,
    comparables: comps,
  }
}

function hasPool(features: any): boolean {
  if (!features) return false
  return !!(features.pool || features.Pool || features.hasPool ||
    (typeof features === 'object' && Object.keys(features).some(k => k.toLowerCase().includes('pool') && features[k])))
}

// ── Sale AVM (sold comps) ─────────────────────────────────────────────────────
export async function getSaleComps(
  address: string,
  city: string,
  state: string,
  zip: string,
  bedrooms: number,
  sqft: number
): Promise<RentCastSaleComps> {
  const fullAddress = `${address}, ${city}, ${state} ${zip}`
  const beds = String(Math.max(1, bedrooms || 3))

  // Fetch sold comps from AVM + the Sold/Inactive listings endpoint (two sources)
  // Also fetch active/pending for market context — clearly labelled in UI, excluded from ARV math
  const [soldAVMResult, soldListingsResult, activeResult, pendingResult] = await Promise.allSettled([
    get(`/avm/value?${new URLSearchParams({ address: fullAddress, bedrooms: beds, compCount: '50', radius: '3' })}`),
    get(`/listings?${new URLSearchParams({ zipCode: zip, status: 'Inactive', bedrooms: beds, limit: '30', radius: '3' })}`),
    get(`/listings?${new URLSearchParams({ zipCode: zip, status: 'Active',   bedrooms: beds, limit: '10', radius: '3' })}`),
    get(`/listings?${new URLSearchParams({ zipCode: zip, status: 'Pending',  bedrooms: beds, limit: '10', radius: '3' })}`),
  ])

  const soldAVMData     = soldAVMResult.status     === 'fulfilled' ? soldAVMResult.value     : { comparables: [], price: 0, priceRangeLow: 0, priceRangeHigh: 0 }
  const soldListingsRaw = soldListingsResult.status === 'fulfilled' ? soldListingsResult.value : []
  const activeData      = activeResult.status       === 'fulfilled' ? activeResult.value      : []
  const pendingData     = pendingResult.status      === 'fulfilled' ? pendingResult.value     : []

  // AVM comparables — map real status: Inactive = sold, Active = active, Pending = pending
  function mapAvmStatus(s: string): 'sold' | 'active' | 'pending' {
    if (s === 'Active')  return 'active'
    if (s === 'Pending') return 'pending'
    return 'sold'  // Inactive, null, or anything else = sold/off-market
  }

  const avmComps = (soldAVMData.comparables ?? [])
    .filter((c: any) => (c.price ?? 0) > 0 && (c.squareFootage ?? 0) > 0)
    .map((c: any) => {
      const mappedStatus = mapAvmStatus(c.status ?? '')
      return {
        address:      c.formattedAddress ?? '',
        bedrooms:     c.bedrooms         ?? 0,
        bathrooms:    c.bathrooms        ?? 0,
        sqft:         c.squareFootage    ?? 0,
        // For sold comps the price is the sale price; for active it's the list price
        salePrice:    mappedStatus === 'sold' ? (c.price ?? 0) : 0,
        listPrice:    c.price            ?? 0,
        pricePerSqft: c.squareFootage    ? (c.price ?? 0) / c.squareFootage : 0,
        distance:     c.distance         ?? 0,
        soldDate:     mappedStatus === 'sold'
          ? (c.removedDate ?? c.lastSeenDate ?? c.listedDate ?? '')
          : (c.listedDate ?? ''),
        status:       mappedStatus,
        hasPool:      hasPool(c.features),
        yearBuilt:    c.yearBuilt        ?? undefined,
        daysOnMarket: c.daysOnMarket     ?? undefined,
        lotSize:      c.lotSize          ?? undefined,
        lat:          c.latitude         ?? undefined,
        lng:          c.longitude        ?? undefined,
      }
    })

  // Inactive/sold listings — actual closed transactions from listing history
  const soldListingsArr = Array.isArray(soldListingsRaw) ? soldListingsRaw : soldListingsRaw?.listings ?? []
  const inactiveComps = soldListingsArr
    .filter((c: any) => (c.price ?? c.lastSalePrice ?? 0) > 0 && (c.squareFootage ?? 0) > 0)
    .map((c: any) => {
      const price = c.lastSalePrice ?? c.price ?? 0
      const sf    = c.squareFootage ?? 0
      return {
        address:      c.formattedAddress ?? '',
        bedrooms:     c.bedrooms         ?? 0,
        bathrooms:    c.bathrooms        ?? 0,
        sqft:         sf,
        salePrice:    price,
        listPrice:    c.price            ?? price,
        pricePerSqft: sf > 0 ? price / sf : 0,
        distance:     c.distance         ?? 0,
        soldDate:     c.lastSaleDate ?? c.removedDate ?? c.listedDate ?? '',
        status:       'sold' as const,
        hasPool:      hasPool(c.features),
        yearBuilt:    c.yearBuilt        ?? undefined,
        daysOnMarket: c.daysOnMarket     ?? undefined,
        lotSize:      c.lotSize          ?? undefined,
        lat:          c.latitude         ?? undefined,
        lng:          c.longitude        ?? undefined,
      }
    })

  // Separate AVM comps by their real status
  const avmSoldComps    = avmComps.filter((c: any) => c.status === 'sold')
  const avmActiveComps  = avmComps.filter((c: any) => c.status === 'active')
  const avmPendingComps = avmComps.filter((c: any) => c.status === 'pending')

  // Merge and deduplicate sold comps by address, prefer AVM data when duplicate
  const seenAddresses = new Set<string>()
  const soldComps = [...avmSoldComps, ...inactiveComps]
    .filter(c => {
      const key = c.address.toLowerCase().trim()
      if (!key) return false
      if (seenAddresses.has(key)) return false
      seenAddresses.add(key)
      return true
    })
    .sort((a: any, b: any) => new Date(b.soldDate).getTime() - new Date(a.soldDate).getTime())

  function mapListing(c: any, status: 'active' | 'pending') {
    const price = c.price ?? c.listPrice ?? 0
    const sf    = c.squareFootage ?? 0
    return {
      address:      c.formattedAddress ?? '',
      bedrooms:     c.bedrooms         ?? 0,
      bathrooms:    c.bathrooms        ?? 0,
      sqft:         sf,
      salePrice:    0,
      listPrice:    price,
      pricePerSqft: sf > 0 ? price / sf : 0,
      distance:     c.distance         ?? 0,
      soldDate:     c.listedDate       ?? c.listDate ?? '',
      status,
      hasPool:      hasPool(c.features),
      yearBuilt:    c.yearBuilt        ?? undefined,
      daysOnMarket: c.daysOnMarket     ?? undefined,
      lotSize:      c.lotSize          ?? undefined,
      lat:          c.latitude         ?? undefined,
      lng:          c.longitude        ?? undefined,
    }
  }

  // Active/pending: merge AVM actives with listings endpoint actives, deduped
  const seenActive = new Set<string>()
  const activeListings = [
    ...avmActiveComps,
    ...(Array.isArray(activeData) ? activeData : activeData.listings ?? [])
      .filter((c: any) => (c.price ?? c.listPrice ?? 0) > 0)
      .map((c: any) => mapListing(c, 'active')),
  ].filter(c => {
    const key = c.address.toLowerCase().trim()
    if (!key || seenActive.has(key)) return false
    seenActive.add(key); return true
  })

  const pendingListings = (Array.isArray(pendingData) ? pendingData : pendingData.listings ?? [])
    .filter((c: any) => (c.price ?? c.listPrice ?? 0) > 0)
    .map((c: any) => mapListing(c, 'pending'))
  pendingListings.push(...avmPendingComps)

  // Sold first so they appear at the top in the UI
  const allComps = [...soldComps, ...activeListings, ...pendingListings]

  return {
    priceLow:        soldAVMData.priceRangeLow  ?? 0,
    priceHigh:       soldAVMData.priceRangeHigh ?? 0,
    priceAvg:        soldAVMData.price          ?? 0,
    pricePerSqftAvg: sqft > 0 ? (soldAVMData.price ?? 0) / sqft : 0,
    comparables:     allComps,
  }
}

// ── Market Data ───────────────────────────────────────────────────────────────
export async function getMarketData(zip: string): Promise<RentCastMarket> {
  const params = new URLSearchParams({ zipCode: zip })
  const data = await get(`/markets?${params}`)
  const market = Array.isArray(data) ? data[0] : data

  return {
    averageRent:  market?.averageRent  ?? 0,
    medianRent:   market?.medianRent   ?? 0,
    rentGrowthPct: (market?.monthlyRentGrowthRate ?? 0) * 12,
    vacancyRate:  market?.vacancyRate  ?? 0.08,
    supplyScore:  market?.totalProperties    ?? 0,
    demandScore:  market?.averageDaysOnMarket ?? 30,
  }
}
