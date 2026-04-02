/**
 * BatchData API client (via BatchLeads key)
 * BatchLeads and BatchData are sister companies — the BatchLeads key works
 * against api.batchdata.io for arbitrary property lookups.
 *
 * Endpoint: POST https://api.batchdata.io/v1/property/lookup
 * Auth: Authorization: Bearer <key>
 */

const BASE = 'https://api.batchdata.io/v1'
const KEY  = process.env.BATCHLEADS_API_KEY!

async function post(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`BatchData ${res.status}: ${text.slice(0, 200)}`)
  try { return JSON.parse(text) } catch { throw new Error('BatchData bad JSON') }
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
  estimatedValue:  number | null   // BatchData AVM
  lastSalePrice:   number | null
  lastSaleDate:    string | null
  equity:          number | null
  ltv:             number | null   // 0-100 percentage
  totalOpenLiens:  number | null
  mortgage:        BatchLeadsMortgage | null
  address:         string | null   // matched address
}

/**
 * Look up property data from BatchData by address.
 * Returns mortgage, lien, equity, and AVM data.
 */
export async function getBatchLeadsProperty(
  address: string,
  city: string,
  state: string,
  zip?: string,
): Promise<BatchLeadsPropertyData | null> {
  if (!KEY) return null

  try {
    const data = await post('/property/lookup', {
      requests: [
        {
          address: {
            street: address,
            city,
            state,
            zip: zip ?? '',
          },
        },
      ],
    })

    // BatchData wraps results in data.results[] or data.responses[]
    const results: any[] =
      data?.results   ??
      data?.responses ??
      data?.data?.results ??
      []

    const prop = results[0]?.property ?? results[0]?.data ?? results[0]
    if (!prop) return null

    // ── Navigate nested BatchData response structure ────────────────────────
    // BatchData returns deeply nested data; field locations vary by plan.
    const valuation = prop.valuation ?? prop.avm ?? prop.value ?? {}
    const mortgage  = prop.openMortgages?.[0] ?? prop.mortgage ?? prop.liens?.mortgages?.[0] ?? null
    const liens     = prop.liens ?? prop.openLiens ?? {}

    const estimatedValue =
      valuation?.estimatedValue ??
      valuation?.value ??
      valuation?.amount ??
      prop.estimatedValue ??
      prop.avm ??
      null

    const equity = valuation?.equity ?? prop.equity ?? liens?.equity ?? null
    const ltv    = valuation?.ltv    ?? prop.ltv    ?? liens?.ltv    ?? null
    const totalOpenLiens =
      liens?.totalOpenLienBalance ??
      liens?.totalBalance ??
      prop.totalOpenLienBalance ??
      null

    const lastSale = prop.saleHistory?.[0] ?? prop.lastSale ?? {}

    let parsedMortgage: BatchLeadsMortgage | null = null
    if (mortgage && typeof mortgage === 'object') {
      parsedMortgage = {
        loanAmount:                   mortgage.loanAmount          ?? mortgage.originalAmount   ?? null,
        loanType:                     mortgage.loanType            ?? mortgage.type             ?? null,
        lenderName:                   mortgage.lenderName          ?? mortgage.lender           ?? null,
        currentEstimatedBalance:      mortgage.currentBalance      ?? mortgage.estimatedBalance ?? mortgage.balance ?? null,
        currentEstimatedInterestRate: mortgage.interestRate        ?? mortgage.rate             ?? null,
        estimatedPaymentAmount:       mortgage.estimatedPayment    ?? mortgage.monthlyPayment   ?? null,
        loanTermMonths:               mortgage.loanTermMonths      ?? mortgage.term             ?? null,
        recordingDate:                mortgage.recordingDate       ?? mortgage.originationDate  ?? null,
      }
    }

    return {
      found:          true,
      estimatedValue: typeof estimatedValue === 'number' ? estimatedValue : null,
      lastSalePrice:  lastSale.salePrice ?? lastSale.price ?? prop.lastSalePrice ?? null,
      lastSaleDate:   lastSale.saleDate  ?? lastSale.date  ?? prop.lastSaleDate  ?? null,
      equity:         typeof equity       === 'number' ? equity       : null,
      ltv:            typeof ltv          === 'number' ? ltv          : null,
      totalOpenLiens: typeof totalOpenLiens === 'number' ? totalOpenLiens : null,
      mortgage:       parsedMortgage,
      address:        prop.address?.oneLine ?? prop.formattedAddress ?? prop.address ?? null,
    }
  } catch (e) {
    console.warn('[BatchData] lookup failed:', e)
    return null
  }
}
