/**
 * Dispo Genius API client
 * Used for buyer matching / dispo network data
 */

const BASE = 'https://api.dispogenius.com/v1'
const KEY = process.env.DISPO_GENIUS_API_KEY!

async function post(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DispoGenius ${res.status}: ${text}`)
  }
  return res.json()
}

export interface BuyerMatch {
  buyerId: string
  name: string
  email?: string
  phone?: string
  maxPrice: number
  targetAreas: string[]
  propertyTypes: string[]
  rehab: 'light' | 'heavy' | 'turnkey'
  closingTimeline: string
  score: number
}

export async function findBuyers(params: {
  zip: string
  city: string
  state: string
  propertyType: string
  arv: number
  repairs: number
  askingPrice: number
}): Promise<BuyerMatch[]> {
  try {
    const data = await post('/buyers/match', params)
    return data.buyers ?? []
  } catch {
    // Dispo Genius may not have buyer data for all markets
    return []
  }
}

export async function submitDeal(params: {
  address: string
  city: string
  state: string
  zip: string
  arv: number
  repairs: number
  wholesalePrice: number
  description: string
}): Promise<{ dealId: string; status: string }> {
  return post('/deals/submit', params)
}
