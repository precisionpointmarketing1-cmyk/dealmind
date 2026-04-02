import { SaleComp } from '@/types/deal'

const BASE    = 'https://api.repliers.io'
const IMG_CDN = 'https://cdn.repliers.io'
const KEY     = process.env.REPLIERS_API_KEY!

async function get(path: string) {
  const url = `${BASE}${path}`
  console.log('[Repliers] GET', url.split('?')[0])

  const res = await fetch(url, {
    headers: {
      'REPLIERS-API-KEY': KEY,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`Repliers ${res.status}: ${text.slice(0, 150)}`)
  try { return JSON.parse(text) } catch { throw new Error(`Repliers bad JSON`) }
}

function imgUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${IMG_CDN}/${path}`
}

function fmtAddress(a: any): string {
  if (!a) return ''
  const parts = [
    [a.streetNumber, a.streetName, a.streetSuffix].filter(Boolean).join(' '),
    a.unitNumber ? `#${a.unitNumber}` : '',
    a.city,
    a.state,
    a.zip,
  ].filter(Boolean)
  return parts.join(', ')
}

export interface RepliersSaleComps {
  comparables: SaleComp[]
  total: number
}

/**
 * Fetch sold comps from Repliers MLS aggregator.
 * Falls back gracefully if the API key isn't set or returns no data.
 */
export async function getRepliersSaleComps(
  zip: string,
  lat: number | undefined,
  lng: number | undefined,
  beds: number,
  sqft: number,
  radiusMiles = 3,
): Promise<RepliersSaleComps> {
  if (!KEY) return { comparables: [], total: 0 }

  try {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 2)
    const minSoldDate = cutoff.toISOString().slice(0, 10)

    const sqftMin = sqft > 0 ? Math.round(sqft * 0.65) : undefined
    const sqftMax = sqft > 0 ? Math.round(sqft * 1.35) : undefined
    const bedsMin = Math.max(1, beds - 1)
    const bedsMax = beds + 1
    // Repliers radius is in km — 1 mile ≈ 1.60934 km
    const radiusKm = Math.round(radiusMiles * 1.60934)

    const params = new URLSearchParams({
      status:          'U',
      lastStatus:      'Sld',
      type:            'Sale',
      class:           'ResidentialProperty',
      minBeds:         String(bedsMin),
      maxBeds:         String(bedsMax),
      minSoldDate,
      sortBy:          'soldDateDesc',
      resultsPerPage:  '30',
      fields:          'mlsNumber,address,map,soldPrice,soldDate,listPrice,daysOnMarket,details.numBedrooms,details.numBathrooms,details.sqft,details.yearBuilt,details.swimmingPool,details.style,images,photoCount',
    })

    // Prefer lat/lng radius; fall back to zip
    if (lat && lng) {
      params.set('lat',    String(lat))
      params.set('long',   String(lng))
      params.set('radius', String(radiusKm))
    } else {
      params.set('zip', zip)
    }

    if (sqftMin) params.set('minSqft', String(sqftMin))
    if (sqftMax) params.set('maxSqft', String(sqftMax))

    const data = await get(`/listings?${params}`)
    const listings: any[] = data?.listings ?? []

    const comps: SaleComp[] = listings
      .filter((l: any) => (l.soldPrice ?? 0) > 0)
      .map((l: any) => {
        const sqftVal   = Number(l.details?.sqft ?? 0)
        const price     = Number(l.soldPrice ?? 0)
        const ppsf      = sqftVal > 0 ? Math.round(price / sqftVal) : 0
        const photos    = (l.images ?? []).slice(0, 5).map((p: string) => imgUrl(p))

        return {
          address:       fmtAddress(l.address),
          bedrooms:      Number(l.details?.numBedrooms ?? 0),
          bathrooms:     Number(l.details?.numBathrooms ?? 0),
          sqft:          sqftVal,
          salePrice:     price,
          listPrice:     Number(l.listPrice ?? price),
          pricePerSqft:  ppsf,
          distance:      0,   // distance not returned unless radius search
          soldDate:      l.soldDate ?? '',
          status:        'sold' as const,
          hasPool:       !!l.details?.swimmingPool,
          yearBuilt:     l.details?.yearBuilt ? Number(l.details.yearBuilt) : undefined,
          daysOnMarket:  l.daysOnMarket ?? undefined,
          lat:           l.map?.latitude  ? Number(l.map.latitude)  : undefined,
          lng:           l.map?.longitude ? Number(l.map.longitude) : undefined,
          mlsNumber:     l.mlsNumber,
          photos,
        }
      })

    return { comparables: comps, total: data?.count ?? comps.length }
  } catch (e) {
    console.warn('[Repliers] getSaleComps failed:', e)
    return { comparables: [], total: 0 }
  }
}
