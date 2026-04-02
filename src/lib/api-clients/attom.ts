import { AttomNeighborhood, AttomSchool, SaleComp } from '@/types/deal'

const BASE = 'https://api.gateway.attomdata.com'
const KEY  = process.env.ATTOM_API_KEY!

async function get(path: string) {
  const url = `${BASE}${path}`
  console.log('[ATTOM] GET', url.split('?')[0])

  const res = await fetch(url, {
    headers: {
      apikey: KEY,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const text = await res.text()
  console.log(`[ATTOM] ${res.status}`, text.slice(0, 200))

  if (!res.ok) throw new Error(`ATTOM ${res.status}: ${text.slice(0, 150)}`)
  try { return JSON.parse(text) } catch { throw new Error(`ATTOM bad JSON: ${text.slice(0, 100)}`) }
}

// ── AVM (Automated Valuation Model) ──────────────────────────────────────────

export interface AttomAVM {
  value:      number
  valueLow:   number
  valueHigh:  number
  confidence: 'high' | 'medium' | 'low'
}

export async function getAttomAVM(
  address: string,
  zip: string
): Promise<AttomAVM | null> {
  try {
    const params = new URLSearchParams({ address, zipcode: zip })
    const data = await get(`/propertyapi/v1.0.0/avm/detail?${params}`)

    const prop = data?.property?.[0]
    const avm  = prop?.avm?.amount
    if (!avm?.value || avm.value <= 0) return null

    const condCode: string = prop?.avm?.condition?.conditionCode ?? 'C'
    const confidence: AttomAVM['confidence'] =
      condCode === 'A' ? 'high' : condCode === 'B' ? 'medium' : 'low'

    return {
      value:     Math.round(avm.value),
      valueLow:  Math.round(avm.low  ?? avm.value * 0.92),
      valueHigh: Math.round(avm.high ?? avm.value * 1.08),
      confidence,
    }
  } catch (e) {
    console.warn('[ATTOM] getAttomAVM failed:', e)
    return null
  }
}

// ── Neighborhood Intelligence ─────────────────────────────────────────────────
// Pulls school ratings, community profile, and market-level stats in one pass.
// Uses 3 ATTOM endpoints fired in parallel:
//   1. /school/snapshot      — nearby schools with ratings
//   2. /community/profile    — demographics, income, crime index
//   3. /sale/snapshot        — recent sales activity for market grade

export async function getAttomNeighborhood(
  address: string,
  zip: string,
  _lat?: number,
  _lng?: number
): Promise<AttomNeighborhood | null> {
  // Uses sale/snapshot exclusively — community/profile (404) and school/snapshot (401)
  // are not available on this subscription tier.
  try {
    const addrParams = new URLSearchParams({ address, zipcode: zip, minsaleamt: '30000', maxsaleamt: '5000000' })
    const data = await get(`/propertyapi/v1.0.0/sale/snapshot?${addrParams}`)

    const sales: any[] = data?.property ?? []
    if (sales.length === 0) return null

    const prices = sales
      .map((s: any) => Number(s?.sale?.amount?.saleAmt ?? 0))
      .filter(v => v > 0)
      .sort((a, b) => a - b)

    let medianSalePrice: number | undefined
    if (prices.length > 0) {
      const mid = Math.floor(prices.length / 2)
      medianSalePrice = prices.length % 2 === 0
        ? Math.round((prices[mid - 1] + prices[mid]) / 2)
        : prices[mid]
    }

    const doms = sales
      .map((s: any) => Number(s?.sale?.calculation?.daysToClose ?? 0))
      .filter(v => v > 0)
      .sort((a, b) => a - b)
    let medianDaysOnMarket: number | undefined
    if (doms.length > 0) {
      const mid = Math.floor(doms.length / 2)
      medianDaysOnMarket = doms[mid]
    }

    const salesVolume12mo = prices.length

    const domScore = !medianDaysOnMarket ? 50 : medianDaysOnMarket <= 20 ? 90 : medianDaysOnMarket <= 45 ? 70 : medianDaysOnMarket <= 90 ? 50 : 30
    const volScore = salesVolume12mo >= 20 ? 85 : salesVolume12mo >= 10 ? 70 : salesVolume12mo >= 5 ? 55 : 35
    const marketGradeScore = Math.round(domScore * 0.6 + volScore * 0.4)
    const marketGrade: AttomNeighborhood['marketGrade'] =
      marketGradeScore >= 80 ? 'A' : marketGradeScore >= 65 ? 'B' : marketGradeScore >= 50 ? 'C' : marketGradeScore >= 35 ? 'D' : 'F'

    return {
      schools: [],
      medianSalePrice,
      medianDaysOnMarket,
      salesVolume12mo,
      marketGrade,
      marketGradeScore,
    }
  } catch (e) {
    console.warn('[ATTOM] getAttomNeighborhood failed:', e)
    return null
  }
}

// ── Sale Comps ────────────────────────────────────────────────────────────────
// Pulls recently-sold comparables from ATTOM to supplement RentCast comps.
// Returns SaleComp[] so they drop straight into the existing comps table.

export async function getAttomSaleComps(
  address: string,
  zip: string,
  beds?: number,
  sqft?: number
): Promise<SaleComp[]> {
  try {
    const params = new URLSearchParams({
      address,
      zipcode:    zip,
      minsaleamt: '30000',
      maxsaleamt: '5000000',
    })
    const data = await get(`/propertyapi/v1.0.0/sale/snapshot?${params}`)

    const props: any[] = data?.property ?? []
    if (!props.length) return []

    const comps: SaleComp[] = []

    for (const p of props) {
      const sale    = p?.sale
      const bldg    = p?.building?.size
      const loc     = p?.location
      const id      = p?.identifier

      const salePrice    = Number(sale?.amount?.saleAmt ?? 0)
      const compSqft     = Number(bldg?.universalSize ?? bldg?.livingSize ?? 0)
      const compBeds     = Number(p?.building?.rooms?.beds ?? 0)
      const compBaths    = Number(p?.building?.rooms?.bathstotal ?? p?.building?.rooms?.bathsfull ?? 0)
      const yearBuilt    = Number(p?.summary?.yearbuilt ?? 0)
      const saleDate     = sale?.saleTransDate ?? ''
      const dom          = Number(sale?.calculation?.daysToClose ?? 0)

      if (salePrice <= 0 || compSqft <= 0) continue

      // Build a best-effort address string
      const streetNo  = id?.apn ? '' : ''
      const compAddr  = [
        loc?.line1 ?? '',
        loc?.locality ?? '',
        loc?.countrySubd ?? '',
        loc?.postal1 ?? '',
      ].filter(Boolean).join(', ') || `APN ${id?.apn ?? '?'}`

      const pricePerSqft = Math.round(salePrice / compSqft)

      // Filter out wildly-mismatched properties (2x sqft or beds off by 3+)
      if (sqft && sqft > 0 && compSqft > 0 && (compSqft / sqft > 2.5 || sqft / compSqft > 2.5)) continue
      if (beds && beds > 0 && compBeds > 0 && Math.abs(compBeds - beds) > 3) continue

      comps.push({
        address:       compAddr,
        bedrooms:      compBeds,
        bathrooms:     compBaths,
        sqft:          compSqft,
        salePrice,
        pricePerSqft,
        distance:      0,   // ATTOM snapshot doesn't return distance
        soldDate:      saleDate,
        status:        'sold',
        yearBuilt:     yearBuilt > 0 ? yearBuilt : undefined,
        daysOnMarket:  dom > 0 ? dom : undefined,
        lat:           loc?.latitude  ? Number(loc.latitude)  : undefined,
        lng:           loc?.longitude ? Number(loc.longitude) : undefined,
      })
    }

    return comps.slice(0, 25)
  } catch (e) {
    console.warn('[ATTOM] getAttomSaleComps failed:', e)
    return []
  }
}
