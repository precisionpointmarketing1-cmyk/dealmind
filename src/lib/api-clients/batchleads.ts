/**
 * BatchLeads API client
 * Searches the user's BatchLeads account for a property by address.
 * Returns mortgage, lien, equity, and AVM data when found.
 *
 * NOTE: Only returns data for properties already imported into the BatchLeads account.
 */

const BASE = 'https://api.batchleads.io'
const KEY  = process.env.BATCHLEADS_API_KEY!

async function post(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'api-key':      KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`BatchLeads ${res.status}: ${text.slice(0, 150)}`)
  try { return JSON.parse(text) } catch { throw new Error('BatchLeads bad JSON') }
}

export interface BatchLeadsMortgage {
  loanAmount:                   number | null
  loanType:                     string | null
  lenderName:                   string | null
  currentEstimatedBalance:      number | null
  currentEstimatedInterestRate: number | null
  estimatedPaymentAmount:       number | null
  loanTermMonths:               number | null
  recordingDate:                string | null
}

export interface BatchLeadsPropertyData {
  found:           boolean
  estimatedValue:  number | null   // AVM
  lastSalePrice:   number | null
  lastSaleDate:    string | null
  equity:          number | null
  ltv:             number | null   // 0-100 percentage
  totalOpenLiens:  number | null
  mortgage:        BatchLeadsMortgage | null
  address:         string | null   // matched address from BatchLeads
}

/**
 * Search BatchLeads account for a property by address string.
 * Returns null if not found or API key not configured.
 */
export async function getBatchLeadsProperty(
  address: string,
  city: string,
  state: string,
): Promise<BatchLeadsPropertyData | null> {
  if (!KEY) return null

  try {
    const searchStr = `${address} ${city} ${state}`
    const data = await post('/api/v1/property', {
      sort_data: 'id',
      sort_type: 'desc',
      page:      1,
      pagesize:  5,
      global_filter: searchStr,
    })

    const props: any[] = data?.data?.data ?? []
    if (props.length === 0) return null

    // Find best match — prefer exact street number + name match
    const addrLower = address.toLowerCase()
    const best = props.find(p => {
      const full = (p.property_full_address ?? '').toLowerCase()
      return full.includes(addrLower.split(',')[0].trim())
    }) ?? props[0]

    if (!best) return null

    const raw = best.mortgage
    const mortgage: BatchLeadsMortgage | null = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? {
          loanAmount:                   raw.loanAmount                   ?? null,
          loanType:                     raw.loanType                     ?? null,
          lenderName:                   raw.lenderName                   ?? null,
          currentEstimatedBalance:      raw.currentEstimatedBalance      ?? null,
          currentEstimatedInterestRate: raw.currentEstimatedInterestRate ?? null,
          estimatedPaymentAmount:       raw.estimatedPaymentAmount       ?? null,
          loanTermMonths:               raw.loanTermMonths               ?? null,
          recordingDate:                raw.recordingDate                ?? null,
        }
      : null

    return {
      found:          true,
      estimatedValue: best.estimated_value            ?? null,
      lastSalePrice:  best.last_sale_price            ?? null,
      lastSaleDate:   best.last_sale_date             ?? null,
      equity:         best.equity_current_estimated_balance ?? null,
      ltv:            best.ltv_current_estimated_combined   ?? null,
      totalOpenLiens: best.total_open_lien_balance    ?? null,
      mortgage,
      address:        best.property_full_address      ?? null,
    }
  } catch (e) {
    console.warn('[BatchLeads] lookup failed:', e)
    return null
  }
}
