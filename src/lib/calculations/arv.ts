import { DealInput, ARVResult, RentCastSaleComps } from '@/types/deal'
import type { HouseCanaryAVM } from '@/lib/api-clients/housecanary'
import type { AttomAVM } from '@/lib/api-clients/attom'

export function calcARV(input: DealInput, saleComps?: RentCastSaleComps, zillowAvgPrice?: number, hcAVM?: HouseCanaryAVM | null, attomAVM?: AttomAVM | null, batchDataAVM?: number | null): ARVResult {
  const { sqft, estimatedARV: userARV } = input

  if (!saleComps || saleComps.comparables.length === 0) {
    return {
      estimatedARV: userARV,
      adjustedARV: userARV,
      confidence: 'low',
      pricePerSqft: sqft > 0 ? userARV / sqft : 0,
      compsUsed: 0,
    }
  }

  // Only sold comps are valid for ARV — active/pending are not evidence of market value
  const soldComps = saleComps.comparables.filter(
    c => c.sqft > 0 && c.salePrice > 0 && c.status === 'sold'
  )

  // Filter out distressed/broken-house comps before ARV calc.
  // A comp with $/sqft < 75% of the group median indicates a distressed sale,
  // not a retail transaction — including it would understate ARV.
  function medianPpsf(comps: typeof soldComps): number {
    const vals = comps.map(c => c.salePrice / c.sqft).sort((a, b) => a - b)
    if (vals.length === 0) return 0
    const mid = Math.floor(vals.length / 2)
    return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid]
  }
  const medPpsf = medianPpsf(soldComps)
  const retailComps = medPpsf > 0
    ? soldComps.filter(c => (c.salePrice / c.sqft) >= medPpsf * 0.75)
    : soldComps

  // ── Method 1: RentCast AVM ────────────────────────────────────────────────
  const rentCastARV = saleComps.priceAvg > 0 ? saleComps.priceAvg : undefined

  // ── Method 2: Weighted $/sqft from RETAIL comps only (distressed excluded) ─
  let compBasedARV: number | undefined
  let weightedPPSF = 0
  const compsForCalc = retailComps.length > 0 ? retailComps : soldComps
  if (compsForCalc.length > 0 && sqft > 0) {
    const totalWeight = compsForCalc.reduce((sum, _, i) => sum + 1 / (i + 1), 0)
    weightedPPSF = compsForCalc.reduce((sum, c, i) => {
      const w = (1 / (i + 1)) / totalWeight
      return sum + (c.salePrice / c.sqft) * w
    }, 0)
    compBasedARV = weightedPPSF * sqft
  }

  // ── Method 3: Median of RETAIL comp prices ───────────────────────────────
  let compMedianARV: number | undefined
  if (compsForCalc.length > 0) {
    const prices = compsForCalc.map(c => c.salePrice).sort((a, b) => a - b)
    const mid = Math.floor(prices.length / 2)
    compMedianARV = prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid]
  }

  // ── Method 4: Zillow comps (HasData) ─────────────────────────────────────
  const zillowARV = zillowAvgPrice && zillowAvgPrice > 0 ? zillowAvgPrice : undefined

  // ── Method 5: HouseCanary AVM ─────────────────────────────────────────────
  const housecanaryARV = hcAVM?.priceMean && hcAVM.priceMean > 0 ? hcAVM.priceMean : undefined

  // ── Method 6: ATTOM AVM ───────────────────────────────────────────────────
  const attomARV = attomAVM?.value && attomAVM.value > 0 ? attomAVM.value : undefined

  // ── Method 7: BatchData AVM ───────────────────────────────────────────────
  const batchDataARV = batchDataAVM && batchDataAVM > 0 ? batchDataAVM : undefined

  // ── ARV Consensus ─────────────────────────────────────────────────────────
  // AVM endpoints (RentCast, ATTOM, HouseCanary, Zillow) estimate the SUBJECT
  // property's current as-is value — NOT its after-repair value. For distressed
  // acquisitions, AVMs will always understate ARV because they see the broken house.
  //
  // Rule: when retail sold comps exist, they ARE the ARV. AVMs are only used as
  // a fallback when no comps are available.
  //
  // With retail comps:   70% weighted $/sqft · 30% comp median
  // Without retail comps: blend AVM sources (best available estimate of area value)

  let adjustedARV: number

  if (compBasedARV && compBasedARV > 0) {
    // Comp-led ARV — sold retail transactions define market value after repair
    const medianWeight = compMedianARV && compMedianARV > 0 ? 0.30 : 0
    const ppsfWeight   = 1 - medianWeight
    adjustedARV = (compBasedARV * ppsfWeight) + ((compMedianARV ?? compBasedARV) * medianWeight)
  } else {
    // No comp data — fall back to AVM blend as directional estimate
    const avmEstimates: { value: number; weight: number }[] = []
    if (rentCastARV && rentCastARV > 0)       avmEstimates.push({ value: rentCastARV,    weight: 0.35 })
    if (housecanaryARV && housecanaryARV > 0) avmEstimates.push({ value: housecanaryARV, weight: 0.30 })
    if (attomARV && attomARV > 0)             avmEstimates.push({ value: attomARV,       weight: 0.20 })
    if (zillowARV && zillowARV > 0)           avmEstimates.push({ value: zillowARV,      weight: 0.15 })

    if (batchDataARV && batchDataARV > 0) avmEstimates.push({ value: batchDataARV, weight: 0.25 })

    if (avmEstimates.length > 0) {
      const totalWeight = avmEstimates.reduce((s, e) => s + e.weight, 0)
      adjustedARV = avmEstimates.reduce((s, e) => s + e.value * (e.weight / totalWeight), 0)
    } else {
      adjustedARV = userARV || 0
    }
  }

  const confidence: 'high' | 'medium' | 'low' =
    soldComps.length >= 5 ? 'high' : soldComps.length >= 3 ? 'medium' : 'low'

  return {
    estimatedARV: userARV,
    rentCastARV,
    compBasedARV,
    compMedianARV,
    zillowARV,
    housecanaryARV,
    housecanaryLow:  hcAVM?.priceLow,
    housecanaryHigh: hcAVM?.priceHigh,
    attomARV,
    attomLow:   attomAVM?.valueLow,
    attomHigh:  attomAVM?.valueHigh,
    batchDataARV,
    adjustedARV,
    confidence,
    pricePerSqft: weightedPPSF || (adjustedARV / (sqft || 1)),
    compsUsed: compsForCalc.length,
  }
}
