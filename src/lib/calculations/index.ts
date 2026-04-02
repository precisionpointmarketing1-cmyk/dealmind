import { DealInput, AnalysisResult, AirbnbMarketData, SaleComp } from '@/types/deal'
import { DEFAULTS } from '@/lib/utils/constants'
import { calcCoreMetrics } from './core-metrics'
import { calcWholesale } from './wholesale'
import { calcSubjectTo } from './subject-to'
import { calcOwnerFinance } from './owner-finance'
import { calcMultiFamily } from './multi-family'
import { calcAirbnb } from './airbnb'
import { calcBRRRR } from './brrrr'
import { calcPrivateMoney } from './private-money'
import { calcCommercial } from './commercial'
import { calcMobileHome } from './mobile-home'
import { calcARV } from './arv'
import { getRentComps, getSaleComps, getMarketData } from '@/lib/api-clients/rentcast'
import { getAirbnbMarketData, getZillowComps } from '@/lib/api-clients/hasdata'
import { getPropertyAVM as getHouseCanaryAVM, getRentalAVM as getHouseCanaryRent, HouseCanaryAVM } from '@/lib/api-clients/housecanary'
import { getAttomAVM, getAttomNeighborhood, getAttomSaleComps, AttomAVM } from '@/lib/api-clients/attom'
import { getRepliersSaleComps } from '@/lib/api-clients/repliers'
import { getBatchLeadsProperty } from '@/lib/api-clients/batchleads'
import { analyzeWithAI } from '@/lib/api-clients/claude'
import { RentCastComps, RentCastSaleComps, RentCastMarket, AttomNeighborhood } from '@/types/deal'

/** Score 0-100 — how similar a comp is to the subject property */
function scoreComp(comp: SaleComp, input: DealInput): number {
  let score = 0

  // Beds similarity (25 pts)
  const bedDiff = Math.abs((comp.bedrooms ?? 0) - (input.bedrooms ?? 0))
  if (bedDiff === 0)      score += 25
  else if (bedDiff === 1) score += 15
  else if (bedDiff === 2) score += 5

  // Baths similarity (15 pts)
  const bathDiff = Math.abs((comp.bathrooms ?? 0) - (input.bathrooms ?? 0))
  if (bathDiff < 0.1)      score += 15
  else if (bathDiff <= 0.5) score += 10
  else if (bathDiff <= 1)   score += 5

  // Sqft proximity (30 pts)
  const subSqft = input.sqft ?? 0
  if (subSqft > 0 && (comp.sqft ?? 0) > 0) {
    const pctDiff = Math.abs(comp.sqft - subSqft) / subSqft
    if (pctDiff <= 0.10)      score += 30
    else if (pctDiff <= 0.20) score += 20
    else if (pctDiff <= 0.30) score += 10
  }

  // Distance (20 pts)
  const dist = comp.distance ?? 99
  if (dist < 0.5)      score += 20
  else if (dist < 1.0) score += 15
  else if (dist < 2.0) score += 10
  else if (dist < 3.0) score += 5

  // Year built proximity (10 pts)
  const subYear = input.yearBuilt ?? 0
  if (subYear > 0 && (comp.yearBuilt ?? 0) > 0) {
    const yrDiff = Math.abs((comp.yearBuilt ?? 0) - subYear)
    if (yrDiff <= 10)      score += 10
    else if (yrDiff <= 20) score += 5
  }

  return Math.min(100, score)
}

export async function analyzeProperty(input: DealInput): Promise<AnalysisResult> {
  // 1. Pull all external data in parallel (RentCast + HasData)
  let rentComps: RentCastComps | undefined
  let saleComps: RentCastSaleComps | undefined
  let marketData: RentCastMarket | undefined
  let airbnbMarket: AirbnbMarketData | undefined
  let zillowAvgPrice: number | undefined
  let hcAVM: HouseCanaryAVM | null = null
  let hcRent: number | undefined
  let attomAVM: AttomAVM | null = null
  let neighborhood: AttomNeighborhood | null = null
  let attomSaleComps: import('@/types/deal').SaleComp[] = []
  let repliersSaleComps: import('@/types/deal').SaleComp[] = []
  let batchLeadsData: import('@/lib/api-clients/batchleads').BatchLeadsPropertyData | null = null

  const [rc, sc, md, ab, zc, hc, hcr, at, nb, atc, rep, bl] = await Promise.allSettled([
    getRentComps(input.address, input.city, input.state, input.zip, input.bedrooms, input.bathrooms),
    getSaleComps(input.address, input.city, input.state, input.zip, input.bedrooms, input.sqft),
    getMarketData(input.zip),
    getAirbnbMarketData(input.city, input.state),
    getZillowComps(input.city, input.state, input.zip, input.bedrooms, input.sqft),
    getHouseCanaryAVM(input.address, input.zip),
    getHouseCanaryRent(input.address, input.zip),
    getAttomAVM(input.address, input.zip),
    getAttomNeighborhood(input.address, input.zip, input.lat, input.lng),
    getAttomSaleComps(input.address, input.zip, input.bedrooms, input.sqft),
    getRepliersSaleComps(input.zip, input.lat, input.lng, input.bedrooms, input.sqft ?? 0),
    getBatchLeadsProperty(input.address, input.city, input.state),
  ])

  if (rc.status === 'fulfilled') rentComps = rc.value
  if (sc.status === 'fulfilled') {
    saleComps = sc.value
    // Score each comp for similarity to subject property
    if (saleComps?.comparables) {
      saleComps.comparables = saleComps.comparables.map(c => ({
        ...c,
        source: 'rentcast' as const,
        likeabilityScore: scoreComp(c, input),
      }))
    }
  }
  if (md.status === 'fulfilled') marketData = md.value
  if (ab.status === 'fulfilled' && ab.value) airbnbMarket = ab.value
  if (zc.status === 'fulfilled' && zc.value) zillowAvgPrice = zc.value.zillowAvgPrice
  if (hc.status === 'fulfilled' && hc.value) hcAVM = hc.value
  if (hcr.status === 'fulfilled' && hcr.value) hcRent = hcr.value.rentalValue
  if (at.status === 'fulfilled' && at.value)  attomAVM = at.value
  if (nb.status === 'fulfilled' && nb.value)  neighborhood = nb.value
  if (atc.status === 'fulfilled' && atc.value?.length) attomSaleComps = atc.value
  if (rep.status === 'fulfilled' && rep.value?.comparables?.length) {
    repliersSaleComps = rep.value.comparables.map(c => ({
      ...c,
      source: 'repliers' as const,
      likeabilityScore: scoreComp(c, input),
    }))
  }
  if (bl.status === 'fulfilled' && bl.value?.found) batchLeadsData = bl.value

  // 2. Determine market rent — blend RentCast + HouseCanary when both available
  const rcRent   = rentComps?.rentAvg ?? 0
  const baseRent = rcRent > 0 && hcRent && hcRent > 0
    ? Math.round((rcRent * 0.6) + (hcRent * 0.4))   // 60/40 blend
    : rcRent > 0 ? rcRent : hcRent ?? Math.max(800, (input.sqft ?? 1500) * 0.65)
  const marketRent = baseRent

  // Override user-supplied expenses with RentCast market data where available
  const rcVacancy    = marketData?.vacancyRate ?? DEFAULTS.VACANCY_RATE
  const rcTaxes      = input.annualTaxes    > 0 ? input.annualTaxes    : Math.round(marketRent * 12 * 0.012)
  const rcInsurance  = input.annualInsurance > 0 ? input.annualInsurance : Math.round(marketRent * 12 * 0.006)

  // 3. ARV — RentCast + comps + Zillow + HouseCanary + ATTOM blended
  const arv = calcARV(input, saleComps, zillowAvgPrice, hcAVM, attomAVM)

  // Compute MAO from RentCast ARV
  const computedMAO = arv.adjustedARV * DEFAULTS.INVESTOR_DISCOUNT - (input.estimatedRepairs ?? 0)

  // If no asking price provided (or 0), run the deal at the MAO — investor's ideal offer
  const effectiveAskingPrice = input.askingPrice && input.askingPrice > 0
    ? input.askingPrice
    : Math.max(0, computedMAO)

  // Inject BatchLeads mortgage data if user didn't supply it manually
  // This powers Subject-To calculations and cash-offer payoff analysis
  const blMortgage = batchLeadsData?.mortgage
  const blLoanBalance  = blMortgage?.currentEstimatedBalance ?? 0
  const blPayment      = blMortgage?.estimatedPaymentAmount  ?? 0
  const blRate         = blMortgage?.currentEstimatedInterestRate
    ? blMortgage.currentEstimatedInterestRate / 100   // BatchLeads stores as %, calcs need decimal
    : 0
  const blTotalLiens   = batchLeadsData?.totalOpenLiens ?? 0

  // Always use RentCast-derived ARV, market expenses, and effective asking price
  // Layer in BatchLeads mortgage intel when user hasn't provided it manually
  const adjustedInput: DealInput = {
    ...input,
    estimatedARV:              arv.adjustedARV,
    askingPrice:               effectiveAskingPrice,
    vacancyRate:               rcVacancy,
    annualTaxes:               rcTaxes,
    annualInsurance:           rcInsurance,
    mgmtFeePct:                DEFAULTS.MGMT_FEE_PCT,
    maintenanceReservePct:     DEFAULTS.MAINTENANCE_RESERVE_PCT,
    annualAppreciation:        input.annualAppreciation ?? DEFAULTS.ANNUAL_APPRECIATION,
    marketCapRate:             input.marketCapRate      ?? DEFAULTS.MARKET_CAP_RATE,
    // Only override with BatchLeads data if user hasn't provided manually
    existingLoanBalance:       input.existingLoanBalance > 0  ? input.existingLoanBalance  : blLoanBalance,
    existingMonthlyPITI:       input.existingMonthlyPITI  > 0 ? input.existingMonthlyPITI  : blPayment,
    existingInterestRate:      input.existingInterestRate > 0  ? input.existingInterestRate  : blRate,
  }

  // 4. Run all strategy calculations in parallel
  const [coreMetrics, wholesale, subjectTo, ownerFinance, multiFamily, airbnb, brrrr, privateMoney, commercial, mobileHome] = await Promise.all([
    Promise.resolve(calcCoreMetrics(adjustedInput, marketRent)),
    Promise.resolve(calcWholesale(adjustedInput)),
    Promise.resolve(calcSubjectTo(adjustedInput, marketRent)),
    Promise.resolve(calcOwnerFinance(adjustedInput, marketRent)),
    Promise.resolve(calcMultiFamily(adjustedInput, marketRent / Math.max(1, input.units ?? 1))),
    Promise.resolve(calcAirbnb(adjustedInput, marketRent, airbnbMarket?.medianNightlyRate)),
    Promise.resolve(calcBRRRR(adjustedInput, marketRent)),
    Promise.resolve(calcPrivateMoney(adjustedInput, arv.adjustedARV)),
    Promise.resolve(calcCommercial(adjustedInput, marketRent)),
    Promise.resolve(calcMobileHome(adjustedInput, marketRent)),
  ])

  const partialResult: Partial<AnalysisResult> = {
    input: adjustedInput,
    coreMetrics,
    wholesale,
    subjectTo,
    ownerFinance,
    multiFamily,
    airbnb,
    brrrr,
    privateMoney,
    commercial,
    mobileHome,
    arv,
    rentComps,
    saleComps,
    marketData,
    airbnbMarket,
    neighborhood:       neighborhood          ?? undefined,
    attomSaleComps:     attomSaleComps.length   > 0 ? attomSaleComps   : undefined,
    repliersSaleComps:  repliersSaleComps.length > 0 ? repliersSaleComps : undefined,
    batchLeadsData:     batchLeadsData ?? undefined,
  }

  // 5. AI analysis
  let aiAnalysis
  try {
    aiAnalysis = await analyzeWithAI(partialResult)
    // Attach AI ARV estimate back to arv result
    if (aiAnalysis?.arvEstimate && aiAnalysis.arvEstimate > 0) {
      arv.aiEstimatedARV = aiAnalysis.arvEstimate
    }
  } catch {
    // AI optional
  }

  return {
    input: adjustedInput,
    coreMetrics,
    wholesale,
    subjectTo,
    ownerFinance,
    multiFamily,
    airbnb,
    brrrr,
    privateMoney,
    commercial,
    mobileHome,
    arv,
    rentComps,
    saleComps,
    marketData,
    airbnbMarket,
    neighborhood:       neighborhood          ?? undefined,
    attomSaleComps:     attomSaleComps.length   > 0 ? attomSaleComps   : undefined,
    repliersSaleComps:  repliersSaleComps.length > 0 ? repliersSaleComps : undefined,
    aiAnalysis,
    analyzedAt: new Date().toISOString(),
  }
}
