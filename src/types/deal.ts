// ─── Input Types ──────────────────────────────────────────────────────────────

export type PropertyType = 'single-family' | 'multi-family' | 'commercial' | 'mobile-home' | 'condo' | 'townhouse' | 'land'

export type ExitStrategy =
  | 'wholesale'
  | 'subject-to'
  | 'owner-finance'
  | 'multi-family'
  | 'airbnb'
  | 'buy-hold'
  | 'brrrr'
  | 'private-money'
  | 'cash-offer'
  | 'listing'

export interface DealInput {
  // Property
  address: string
  city: string
  state: string
  zip: string
  lat?: number
  lng?: number
  propertyType: PropertyType
  bedrooms: number
  bathrooms: number
  sqft: number
  yearBuilt: number
  units?: number // for multi-family

  // Financials
  askingPrice: number
  assignmentFee: number         // wholesaler's markup — added to askingPrice for investor's purchase price
  emd?: number                  // earnest money deposit to tie up deal (from company settings)
  estimatedARV: number
  estimatedRepairs: number

  // Existing loan (for subject-to)
  existingLoanBalance?: number
  existingMonthlyPITI?: number
  existingInterestRate?: number
  existingRemainingMonths?: number

  // New financing
  downPaymentPct: number
  interestRate: number
  loanTermMonths: number

  // Operating expenses
  vacancyRate: number
  mgmtFeePct: number
  annualTaxes: number
  annualInsurance: number
  maintenanceReservePct: number

  // Airbnb specific
  adr?: number           // average daily rate
  strOccupancy?: number  // short-term rental occupancy (decimal)
  platformFeePct?: number
  furnishingCost?: number

  // Market assumptions
  annualAppreciation?: number
  marketCapRate?: number

  // Private money / hard money financing params
  hardMoneyRate?: number           // interest rate, default 0.12
  hardMoneyPoints?: number         // points (%), default 2.5
  hardMoneyTermMonths?: number     // loan term in months, default 12

  // Commercial-specific inputs
  commercialAnnualNOI?: number     // known annual NOI
  commercialLeaseType?: 'nnn' | 'gross' | 'modified-gross'
  commercialTenantCount?: number

  // Mobile home / trailer
  mobileHomeParkOwned?: boolean    // true = land owned by park (lot rent applies)
  mobileHomeLotRent?: number       // monthly lot rent if park-owned

  // Repair details (captured in form)
  repairNotes?: string
  knownIssues?: { description: string; estimatedCost: number; photos?: string[] }[]
}

// ─── RentCast API Types ───────────────────────────────────────────────────────

export interface RentCastComps {
  rentLow: number
  rentHigh: number
  rentAvg: number
  comparables: RentComp[]
}

export interface RentComp {
  address: string
  bedrooms: number
  bathrooms: number
  sqft: number
  rent: number
  distance: number
  listedDate: string
}

export interface RentCastMarket {
  averageRent: number
  medianRent: number
  rentGrowthPct: number
  vacancyRate: number
  supplyScore: number
  demandScore: number
}

export interface RentCastSaleComps {
  priceLow: number
  priceHigh: number
  priceAvg: number
  pricePerSqftAvg: number
  comparables: SaleComp[]
}

export interface SaleComp {
  address: string
  bedrooms: number
  bathrooms: number
  sqft: number
  salePrice: number      // sold price (or list price for active/pending)
  listPrice?: number     // original list price
  pricePerSqft: number
  distance: number
  soldDate: string       // sold date OR listed date
  status: 'sold' | 'active' | 'pending'
  hasPool?: boolean
  yearBuilt?: number
  daysOnMarket?: number
  lotSize?: number           // lot/land square footage
  lat?: number
  lng?: number
  likeabilityScore?: number  // 0-100 feature-based similarity to subject property
  mlsNumber?: string         // MLS listing ID (from Repliers)
  photos?: string[]          // MLS listing photos (from Repliers)
  source?: 'rentcast' | 'attom' | 'repliers'
}

// ─── Calculation Results ──────────────────────────────────────────────────────

export interface CoreMetrics {
  // Pricing
  lao: number               // lowest allowable offer  — ARV * 60% - repairs (opening/target)
  mao: number               // max allowable offer     — ARV * 70% - repairs (ceiling)
  arvDiscount: number       // ARV * 0.70
  equityAtPurchase: number  // ARV - asking price

  // Income (annual, using market rent)
  grossRentAnnual: number
  effectiveGrossIncome: number
  operatingExpenses: number
  noi: number               // net operating income

  // Returns
  capRate: number
  grm: number               // gross rent multiplier
  cashOnCashReturn: number
  dscr: number              // debt service coverage ratio
  annualDebtService: number
  monthlyDebtService: number
  loanAmount: number
  purchasePrice: number     // price used for all financing calcs (asking or MAO)
  monthlyCashFlow: number
  annualCashFlow: number

  // Equity / wealth
  totalProjectedReturn5yr: number
  equityAt5yr: number
  appreciationAt5yr: number
}

export interface WholesaleResult {
  eligible: boolean
  lao: number               // lowest allowable offer (opening target)
  mao: number               // max allowable offer (ceiling)
  suggestedOfferPrice: number
  wholesaleFee: number         // assignment fee earned
  assignmentFeePctARV: number  // fee as % of ARV
  endBuyerPrice: number
  endBuyerEquity: number       // ARV - endBuyerPrice - repairs
  endBuyerROI: number          // endBuyerEquity / endBuyerPrice
  estimatedEMD: number         // earnest money deposit to tie up deal
  roiOnEMD: number             // wholesaleFee / estimatedEMD
  arv: number
  repairCost: number
  spreadToBuyer: number
  dealScore: number
  notes: string[]
}

export interface SubjectToResult {
  eligible: boolean
  existingLoanBalance: number
  existingMonthlyPITI: number
  existingRate: number
  remainingMonths: number

  // ── Entry Fee Analysis (Pace Morby methodology) ───────────────────────────
  entryFee: number              // recommended entry fee (deal-viability based, NOT asking price)
  maxEntryFee: number           // absolute max: keeps equity ≥ 20% after repairs & closing
  entryFeeMin: number           // floor: just closing costs to get the deed
  closingCosts: number
  totalCashToClose: number      // recommended entryFee + closingCosts
  acquisitionCost: number       // alias for totalCashToClose

  // ── Equity ────────────────────────────────────────────────────────────────
  equitySpread: number          // ARV − loan balance (raw equity before any fee/repairs)
  equityCapture: number         // ARV − loan balance − entryFee − repairs (instant equity)
  ltvRatio: number              // loan balance / ARV
  equityPct: number             // (ARV - loan) / ARV

  // ── Cash Flow ─────────────────────────────────────────────────────────────
  cashFlowUnfinanced: number    // rent - PITI - expenses (entry fee paid in cash)
  cashFlowFinanced: number      // same but minus private-money I/O payment on entry fee
  cashFlowWithSubTo: number     // alias for cashFlowUnfinanced (backward compat)
  privateLenderPayment: number  // 10% I/O on recommended entry fee
  breakEvenRent: number         // min gross rent for breakeven (unfinanced)
  cashOnCash: number            // annual unfinanced cash flow / total cash to close

  // ── Rate Advantage ────────────────────────────────────────────────────────
  newLoanPayment: number        // what a new market-rate loan would cost/mo
  rateSavingsMonthly: number    // new loan payment - existing PITI (monthly advantage)
  paymentSpread: number         // same as rateSavingsMonthly; Pace's "payment spread"
  lifetimeRateSavings: number   // rateSavingsMonthly × remainingMonths

  // ── Wrap Potential ────────────────────────────────────────────────────────
  wrapMonthlyPayment: number    // payment if sold on wraparound at 8% / 30yr on 90% ARV
  wrapPaymentSpread: number     // wrap payment collected - PITI paid = monthly spread

  // ── Equity Buildup ────────────────────────────────────────────────────────
  monthlyEquityBuildup: number  // principal portion of existing PITI
  vsNewFinancing: number        // cashFlowWithSubTo - cash flow on new loan

  dealScore: number
  notes: string[]
}

export interface OwnerFinanceResult {
  eligible: boolean
  purchasePrice: number
  downPayment: number
  sellerCarryAmount: number
  proposedRate: number
  proposedTermMonths: number
  balloonMonths: number          // when balloon payment is due (default 60 = 5yr)
  balloonBalance: number         // remaining principal at balloon date
  totalInterestToSeller: number  // total interest paid until balloon
  sellerTotalReturn: number      // down + payments + balloon balance
  monthlyPaymentToSeller: number
  monthlyRentIncome: number
  monthlyOpEx: number
  monthlySpread: number
  annualSpread: number
  cashOnCash: number             // annual spread / down payment
  yieldToSeller: number
  dealScore: number
  notes: string[]
}

export interface MultiFamilyResult {
  eligible: boolean
  units: number
  perUnitValue: number
  perUnitRent: number
  totalMonthlyRent: number
  grossRentMultiplier: number
  effectiveGrossIncome: number
  totalOpExpenses: number
  expenseRatio: number           // opEx / grossRent
  noi: number
  capRate: number
  dscr: number
  cashFlow: number
  cashOnCash: number
  totalCashIn: number
  breakEvenOccupancy: number     // occupancy needed to cover debt + opex
  valuationByCapRate: number
  dealScore: number
  notes: string[]
}

export interface AirbnbResult {
  eligible: boolean
  // ── DSCR Loan Financing ─────────────────────────────────────────────────────
  dscrLoanAmount: number       // 75% LTV of purchase price
  dscrDownPayment: number      // 25% down payment
  dscrRate: number             // DSCR loan rate (min 7.5%)
  dscrMonthlyPayment: number   // monthly P&I on DSCR loan
  dscrMonthlyPITIA: number     // P&I + taxes/12 + insurance/12 (what lender underwrites)
  dscrAnnualPITIA: number      // annualized PITIA
  // ── LTR (Long-Term Rental) ──────────────────────────────────────────────────
  ltrMonthlyRent: number       // market rent
  ltrDSCR: number              // gross rent / PITIA (lender qualifying ratio)
  ltrMonthlyCashFlow: number   // rent - PITIA - vacancy - mgmt - maintenance
  ltrAnnualCashFlow: number
  ltrCashOnCash: number
  ltrQualifies: boolean        // ltrDSCR >= 1.0
  // ── STR (Short-Term Rental / Airbnb) ────────────────────────────────────────
  monthlyRevenue: number       // gross STR revenue
  annualRevenue: number
  platformFees: number
  mgmtFees: number
  strDSCR: number              // (annualRevenue * 0.75) / annualPITIA — lender STR haircut
  strQualifies: boolean        // strDSCR >= 1.0
  operatingExpenses: number    // all STR opex (annual)
  annualDebtService: number    // DSCR loan annual P&I
  monthlyNetIncome: number     // STR net monthly
  netIncome: number            // STR net annual
  cashOnCash: number           // STR CoC
  totalCashIn: number          // down + closing + furnishing
  vsLongTermRental: number     // STR net annual premium over LTR
  furnishingCost: number
  paybackMonths: number        // months to recoup furnishing premium vs LTR
  revenuePerNight: number      // effective ADR * occupancy
  dealScore: number
  notes: string[]
}

export interface ARVResult {
  estimatedARV: number      // user-entered estimate
  rentCastARV?: number      // RentCast AVM model
  compBasedARV?: number     // weighted $/sqft from sold comps
  compMedianARV?: number    // simple median of sold comp prices
  aiEstimatedARV?: number   // Claude AI estimate
  zillowARV?: number        // Zillow recently-sold comps (HasData)
  housecanaryARV?: number   // HouseCanary AVM
  housecanaryLow?: number
  housecanaryHigh?: number
  housecanaryRent?: number  // HouseCanary rental AVM cross-check
  attomARV?: number         // ATTOM AVM
  attomLow?: number
  attomHigh?: number
  batchDataARV?: number     // BatchData AVM (via BatchLeads key)
  adjustedARV: number       // blended consensus — used for all calculations
  confidence: 'high' | 'medium' | 'low'
  pricePerSqft: number
  compsUsed: number
}

// ─── HasData Types ────────────────────────────────────────────────────────────

export interface AirbnbMarketData {
  averageNightlyRate: number
  medianNightlyRate: number
  sampleCount: number
  estimatedOccupancy: number
  priceRange: { low: number; high: number }
  source: 'hasdata'
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

export type GradeLevel = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'

export interface MarketGrade {
  overall: GradeLevel
  marketConditions: GradeLevel
  localMarket: GradeLevel
  populationTrend: GradeLevel
  rentGrowth: GradeLevel
  supplyDemand: GradeLevel
  summary: string
  bullPoints: string[]
  bearPoints: string[]
}

export interface StrategyRank {
  strategy: ExitStrategy
  rank: number
  score: number
  rationale: string
  projectedROI: number
  riskLevel: 'low' | 'medium' | 'high'
}

export interface AIAnalysis {
  dealSummary: string           // 5-7 sentence comprehensive deal thesis
  sellerProfile?: string        // seller motivation/situation analysis
  acquisitionAnalysis?: string  // best way to structure the deal with reasoning
  marketAnalysis?: string       // market conditions, trends, timing
  exitAnalysis?: string         // best exit strategy with projected returns
  recommendedStrategy: ExitStrategy
  strategyRankings: StrategyRank[]
  marketGrade: MarketGrade
  keyRisks: string[]
  keyOpportunities: string[]
  negotiationTips: string[]
  redFlags: string[]
  aiConfidence: number // 0-100
  arvEstimate?: number // Claude's ARV estimate
  generatedAt: string
}

// ─── Photo Rehab Scan ────────────────────────────────────────────────────────

export interface RehabCategory {
  name: string
  estimateLow: number
  estimateHigh: number
  condition: 'poor' | 'fair' | 'good'
  notes?: string
}

export interface RehabScan {
  rentalRehab: number      // rent-ready budget — cosmetic/functional minimum to attract a tenant
  fullFixFlip: number      // retail-ready budget — full renovation to maximize resale value
  totalEstimate: number    // backwards-compat alias (= fullFixFlip)
  confidence: string
  summary: string
  categories: RehabCategory[]
  redFlags: string[]
  assumptions?: string[]
  // Photo walkthrough — parallel array to the photos submitted; sorted in walkthrough order
  photoLabels?: string[]   // room/area label for each photo e.g. "Kitchen", "Master Bedroom"
  photoOrder?: number[]    // suggested display order (indices into original photo array)
}

export interface BRRRRResult {
  eligible: boolean
  totalCashIn: number         // purchase + repairs + closing costs
  refiLoanAmount: number      // ARV × refi LTV
  refiLTV: number             // loan-to-value on refi (0.75)
  cashReturned: number        // cash pulled out at refi
  cashLeftInDeal: number      // total cash in - cash returned
  refiMonthlyPayment: number  // P&I on the refi loan
  monthlyCashFlow: number     // rent - refi pmt - opex
  annualCashFlow: number
  cashOnCash: number          // annual CF / cash left in deal
  equityCapture: number       // ARV - total all-in cost
  refiCoverage: number        // refi loan / total cash in (how much is returned)
  marketRent: number
  totalOpex: number
  dealScore: number
  notes: string[]
}

export interface PrivateMoneyResult {
  eligible: boolean
  loanAmountByARV: number       // ARV * 0.70
  loanAmountByLTC: number       // purchase * 0.90 + repairs
  maxLoan: number               // min of the two
  points: number                // points %
  pointsCost: number            // dollar cost of points
  rate: number                  // annual interest rate
  monthlyInterest: number       // interest-only payment
  holdingPeriodMonths: number   // expected hold
  totalInterest: number         // monthly * holding period
  totalCostOfCapital: number    // points + total interest
  cashRequiredToClose: number   // purchase - loan + closing costs
  allInCost: number             // purchase + repairs + closing
  annualizedCostPct: number     // total cost of capital / loan
  dealScore: number
}

export interface CommercialResult {
  eligible: boolean
  purchasePrice: number
  annualNOI: number
  capRate: number
  marketCapRate: number
  valueByCapRate: number        // NOI / marketCapRate
  pricePerSqft: number
  annualDebtService: number
  dscr: number
  annualCashFlow: number
  monthlyCashFlow: number
  cashOnCash: number
  totalCashIn: number
  dealScore: number
}

export interface MobileHomeResult {
  eligible: boolean
  purchasePrice: number
  parkOwned: boolean
  monthlyLotRent: number
  marketRent: number
  netMonthlyRent: number        // marketRent - lotRent
  monthlyExpenses: number
  monthlyCashFlow: number
  annualCashFlow: number
  cashOnCash: number
  allCashCapRate: number        // NOI / purchase (for all-cash deals)
  dealScore: number
}

// ─── Full Analysis Result ─────────────────────────────────────────────────────

// ─── ATTOM Neighborhood / Market Intelligence ─────────────────────────────────

export interface AttomSchool {
  name: string
  type: 'elementary' | 'middle' | 'high' | 'other'
  gradeRange: string
  rating?: number       // 1–10 GreatSchools-style
  distance?: number     // miles
}

export interface AttomNeighborhood {
  // Schools
  schools: AttomSchool[]
  schoolDistrictName?: string

  // Community & demographics
  medianHouseholdIncome?: number
  medianHomeValue?: number
  ownerOccupiedPct?: number
  renterOccupiedPct?: number
  populationDensity?: number

  // Market health
  marketGrade?: 'A' | 'B' | 'C' | 'D' | 'F'
  marketGradeScore?: number   // 0–100
  crimeIndex?: number         // lower = safer (national avg = 100)
  walkScore?: number

  // Sale activity
  medianSalePrice?: number
  medianDaysOnMarket?: number
  salesVolume12mo?: number
}

export interface AnalysisResult {
  input: DealInput
  coreMetrics: CoreMetrics
  wholesale: WholesaleResult
  subjectTo: SubjectToResult
  ownerFinance: OwnerFinanceResult
  multiFamily: MultiFamilyResult
  airbnb: AirbnbResult
  brrrr: BRRRRResult
  privateMoney: PrivateMoneyResult
  commercial: CommercialResult
  mobileHome: MobileHomeResult
  arv: ARVResult
  rentComps?: RentCastComps
  saleComps?: RentCastSaleComps
  marketData?: RentCastMarket
  airbnbMarket?: AirbnbMarketData   // HasData — live Airbnb market rates
  neighborhood?: AttomNeighborhood  // ATTOM schools + community + market grade
  attomSaleComps?: SaleComp[]       // ATTOM independent sold comps (separate from RentCast)
  repliersSaleComps?: SaleComp[]    // Repliers MLS sold comps
  batchLeadsData?: import('@/lib/api-clients/batchleads').BatchLeadsPropertyData
  aiAnalysis?: AIAnalysis
  rehabScan?: RehabScan
  addedRepairItems?: { description: string; cost: number }[]  // items added via AI chat on dashboard
  propertyPhotos?: string[]
  analyzedAt: string
}
