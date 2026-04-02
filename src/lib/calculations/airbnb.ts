import { DealInput, AirbnbResult } from '@/types/deal'
import { DEFAULTS, CLOSING_COST_PCT } from '@/lib/utils/constants'
import { monthlyPayment } from '@/lib/utils/formatters'

/**
 * DSCR Loan / Buy & Hold strategy
 *
 * DSCR loans are the primary financing vehicle investors use to buy rental properties
 * (both LTR and STR). Key facts about DSCR loans:
 * - LTV: 75% (25% down — higher than conventional due to investor risk)
 * - Rate: typically 0.5–1.5% above 30-yr fixed; minimum ~7.5% in current market
 * - Qualifying ratio: DSCR = Gross Rent / PITIA (must be ≥ 1.0, prefer ≥ 1.25)
 * - For STR: lenders apply a 75% income haircut (use 75% of projected STR revenue)
 * - No personal income verification — the property cash flows must cover the loan
 * - Taxes/insurance rolled into PITIA for DSCR calculation
 */
export function calcAirbnb(
  input: DealInput,
  longTermRent: number,
  adrOverride?: number
): AirbnbResult {
  const {
    askingPrice,
    adr,
    strOccupancy = 0.65,
    platformFeePct = DEFAULTS.AIRBNB_PLATFORM_FEE,
    furnishingCost = 15_000,
    interestRate,
    vacancyRate,
    mgmtFeePct,
    annualTaxes,
    annualInsurance,
    maintenanceReservePct,
    propertyType,
    city,
  } = input

  // ── DSCR Loan Terms ─────────────────────────────────────────────────────────
  // DSCR lenders require 25% down and price rate at min 7.5%
  const DSCR_LTV = 0.75
  const DSCR_MIN_RATE = 0.075
  const dscrLoanAmount   = Math.round(askingPrice * DSCR_LTV)
  const dscrDownPayment  = Math.round(askingPrice * (1 - DSCR_LTV))
  const dscrRate         = Math.max(interestRate, DSCR_MIN_RATE)
  const dscrMonthlyPayment = monthlyPayment(dscrLoanAmount, dscrRate, 360) // 30-yr fixed
  const monthlyTaxes     = annualTaxes / 12
  const monthlyInsurance = annualInsurance / 12
  const dscrMonthlyPITIA = dscrMonthlyPayment + monthlyTaxes + monthlyInsurance
  const dscrAnnualPITIA  = dscrMonthlyPITIA * 12
  const annualDebtService = dscrMonthlyPayment * 12

  // ── LTR (Long-Term Rental) Analysis ─────────────────────────────────────────
  const ltrMonthlyRent = longTermRent
  const ltrGrossAnnual = ltrMonthlyRent * 12
  // DSCR = Gross Annual Rent / Annual PITIA
  const ltrDSCR = dscrAnnualPITIA > 0 ? ltrGrossAnnual / dscrAnnualPITIA : 0
  const ltrQualifies = ltrDSCR >= 1.0

  // Monthly LTR cash flow: rent - vacancy - mgmt - maintenance - PITIA
  const ltrVacancyLoss     = ltrMonthlyRent * vacancyRate
  const ltrMgmtFee         = ltrMonthlyRent * mgmtFeePct
  const ltrMaintenance     = ltrMonthlyRent * maintenanceReservePct
  const ltrMonthlyCashFlow = ltrMonthlyRent - ltrVacancyLoss - ltrMgmtFee - ltrMaintenance - dscrMonthlyPITIA
  const ltrAnnualCashFlow  = ltrMonthlyCashFlow * 12

  const closingCosts = askingPrice * CLOSING_COST_PCT
  const ltrTotalCashIn  = dscrDownPayment + closingCosts
  const ltrCashOnCash   = ltrTotalCashIn > 0 ? ltrAnnualCashFlow / ltrTotalCashIn : 0

  // ── STR (Short-Term Rental / Airbnb) Analysis ────────────────────────────────
  const effectiveADR   = adrOverride ?? adr ?? longTermRent / 20
  const monthlyRevenue = effectiveADR * 30 * strOccupancy
  const annualRevenue  = monthlyRevenue * 12
  const revenuePerNight = effectiveADR * strOccupancy

  const platformFees     = annualRevenue * platformFeePct
  const strMgmtFee       = annualRevenue * DEFAULTS.AIRBNB_MGMT_FEE
  const supplyRestocking = annualRevenue * DEFAULTS.STR_SUPPLY_RESTOCKING_PCT
  const maintenance      = longTermRent * 12 * maintenanceReservePct
  const operatingExpenses = platformFees + strMgmtFee + supplyRestocking + annualTaxes + annualInsurance + maintenance

  // DSCR for STR: lenders apply 75% haircut to STR income to account for volatility
  const strDSCR      = dscrAnnualPITIA > 0 ? (annualRevenue * 0.75) / dscrAnnualPITIA : 0
  const strQualifies = strDSCR >= 1.0

  const netIncome       = annualRevenue - operatingExpenses - annualDebtService
  const monthlyNetIncome = netIncome / 12

  const strTotalCashIn = dscrDownPayment + closingCosts + furnishingCost
  const cashOnCash     = strTotalCashIn > 0 ? netIncome / strTotalCashIn : 0

  const vsLongTermRental = netIncome - ltrAnnualCashFlow
  const paybackMonths    = furnishingCost > 0 && vsLongTermRental > 0
    ? furnishingCost / (vsLongTermRental / 12)
    : 0

  // ── Eligibility ───────────────────────────────────────────────────────────
  const restrictedMarkets = ['new york', 'san francisco', 'los angeles', 'santa monica', 'miami beach']
  const isRestricted = restrictedMarkets.some(m => city.toLowerCase().includes(m))
  const eligible     = !isRestricted && propertyType !== 'land'

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notes: string[] = []

  if (!ltrQualifies) {
    notes.push(`LTR DSCR ${ltrDSCR.toFixed(2)}x is below 1.0 — property does NOT qualify for a DSCR loan on LTR income alone`)
  } else if (ltrDSCR >= 1.25) {
    notes.push(`Strong DSCR of ${ltrDSCR.toFixed(2)}x on LTR — well above lender minimum, easy to qualify`)
  } else {
    notes.push(`LTR DSCR ${ltrDSCR.toFixed(2)}x qualifies (≥1.0) — on the tighter side; some lenders prefer ≥1.25`)
  }

  if (strQualifies && !ltrQualifies) {
    notes.push(`STR DSCR ${strDSCR.toFixed(2)}x qualifies on STR income — but many lenders only use LTR rents to underwrite STR properties`)
  }

  if (isRestricted) {
    notes.push(`${city} has strict STR regulations — verify permitting before investing in furnishings`)
  }

  if (vsLongTermRental > 5_000) {
    notes.push(`STR generates ${fmt(vsLongTermRental)}/yr more than LTR — strong case for Airbnb if market regulations allow`)
  } else if (vsLongTermRental < 0) {
    notes.push(`LTR outperforms STR by ${fmt(Math.abs(vsLongTermRental))}/yr at current ADR/occupancy — consider sticking with LTR`)
  }

  if (paybackMonths > 0 && paybackMonths < 24) {
    notes.push(`${fmt(furnishingCost)} furnishing cost recouped in ${Math.round(paybackMonths)} months vs LTR income`)
  }

  if (ltrMonthlyCashFlow < 0) {
    notes.push(`Negative LTR cash flow of ${fmt(Math.abs(ltrMonthlyCashFlow))}/mo — review purchase price vs market rents`)
  }

  // ── Deal Score ────────────────────────────────────────────────────────────
  let score = 0
  if (eligible) {
    // DSCR qualification (40 pts max)
    if (ltrDSCR >= 1.25)      score += 40
    else if (ltrDSCR >= 1.0)  score += 25
    else if (strDSCR >= 1.0)  score += 10

    // Cash-on-cash return (30 pts max)
    const bestCoC = Math.max(ltrCashOnCash, cashOnCash)
    if (bestCoC >= 0.12)      score += 30
    else if (bestCoC >= 0.08) score += 20
    else if (bestCoC >= 0.05) score += 10

    // LTR cash flow (20 pts max)
    if (ltrMonthlyCashFlow >= 400)  score += 20
    else if (ltrMonthlyCashFlow >= 200) score += 12
    else if (ltrMonthlyCashFlow >= 0)   score += 5

    // STR premium (10 pts max)
    if (vsLongTermRental > 8_000)  score += 10
    else if (vsLongTermRental > 0) score += 5
  }

  return {
    eligible,
    // DSCR loan
    dscrLoanAmount,
    dscrDownPayment,
    dscrRate,
    dscrMonthlyPayment,
    dscrMonthlyPITIA,
    dscrAnnualPITIA,
    // LTR
    ltrMonthlyRent,
    ltrDSCR,
    ltrMonthlyCashFlow,
    ltrAnnualCashFlow,
    ltrCashOnCash,
    ltrQualifies,
    // STR
    monthlyRevenue,
    annualRevenue,
    platformFees,
    mgmtFees: strMgmtFee,
    strDSCR,
    strQualifies,
    operatingExpenses,
    annualDebtService,
    monthlyNetIncome,
    netIncome,
    cashOnCash,
    totalCashIn: strTotalCashIn,
    vsLongTermRental,
    furnishingCost,
    paybackMonths,
    revenuePerNight,
    dealScore: Math.min(100, Math.round(score)),
    notes,
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
