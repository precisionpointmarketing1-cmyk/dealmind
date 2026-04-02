import { DealInput, BRRRRResult } from '@/types/deal'
import { DEFAULTS, CLOSING_COST_PCT } from '@/lib/utils/constants'
import { monthlyPayment } from '@/lib/utils/formatters'

// BRRRR = Buy · Rehab · Rent · Refinance · Repeat
// The play: buy distressed, rehab, refi at ARV, pull cash back out, repeat.

const REFI_LTV = 0.75  // standard cash-out refi: 75% of ARV

export function calcBRRRR(input: DealInput, marketRent: number): BRRRRResult {
  const arv      = input.estimatedARV   // already set to adjusted ARV
  const purchase = input.askingPrice
  const repairs  = input.estimatedRepairs ?? 0

  const closingCosts = purchase * CLOSING_COST_PCT
  const totalCashIn  = purchase + repairs + closingCosts

  // After rehab: cash-out refi at 75% LTV of ARV
  const refiLoanAmount = arv * REFI_LTV
  const cashReturned   = Math.min(refiLoanAmount, totalCashIn)
  const cashLeftInDeal = Math.max(0, totalCashIn - cashReturned)

  // Monthly P&I on the refi loan (30-yr at market rate)
  const refiMonthlyPayment = monthlyPayment(refiLoanAmount, input.interestRate, 360)

  // Operating expenses (monthly)
  const vacancy     = marketRent * input.vacancyRate
  const mgmt        = marketRent * input.mgmtFeePct
  const maintenance = marketRent * (input.maintenanceReservePct + DEFAULTS.CAPEX_RESERVE_PCT)
  const taxes       = input.annualTaxes / 12
  const insurance   = input.annualInsurance / 12
  const totalOpex   = vacancy + mgmt + maintenance + taxes + insurance

  const monthlyCashFlow = marketRent - refiMonthlyPayment - totalOpex
  const annualCashFlow  = monthlyCashFlow * 12

  // CoC on remaining cash (can be very high or infinite when cashLeft ≈ 0)
  const cashOnCash = cashLeftInDeal > 500
    ? annualCashFlow / cashLeftInDeal
    : annualCashFlow > 0 ? 9.99 : 0   // cap display at 999% when near-infinite

  const equityCapture = arv - totalCashIn
  const refiCoverage  = totalCashIn > 0 ? refiLoanAmount / totalCashIn : 0

  // Eligible: meaningful rehab needed + refi covers ≥70% of cash in + positive equity
  const eligible = repairs >= 5_000 && refiCoverage >= 0.70 && equityCapture > 0

  const notes: string[] = []
  if (!eligible) {
    if (repairs < 5_000) notes.push('BRRRR requires a significant rehab — low/no repairs means no value-add to refi against')
    if (refiCoverage < 0.70) notes.push('Refi would not return enough capital to recycle — purchase price too high relative to ARV')
    if (equityCapture <= 0) notes.push('No equity capture after all-in costs — ARV must exceed purchase + repairs + closing costs')
  } else {
    if (cashLeftInDeal < 5_000) notes.push('Near-infinite returns — virtually all cash returned at refi')
    if (cashLeftInDeal < totalCashIn * 0.10) notes.push(`Only ${Math.round(refiCoverage * 100)}% of cash recycled — excellent capital efficiency`)
    if (monthlyCashFlow < 0) notes.push('Negative cash flow after refi payment — consider lower purchase price or higher rent market')
    if (equityCapture > 50_000) notes.push(`Strong equity capture of $${equityCapture.toLocaleString()} at refi`)
  }

  // Score
  let score = 0
  if (eligible) {
    score += 25
    score += refiCoverage >= 0.90 ? 20 : refiCoverage >= 0.80 ? 15 : refiCoverage >= 0.70 ? 10 : 0
    score += monthlyCashFlow > 400 ? 20 : monthlyCashFlow > 200 ? 15 : monthlyCashFlow > 0 ? 10 : 0
    score += cashOnCash > 0.20 ? 20 : cashOnCash > 0.12 ? 15 : cashOnCash > 0.08 ? 10 : 0
    score += equityCapture > 50_000 ? 15 : equityCapture > 25_000 ? 10 : equityCapture > 10_000 ? 5 : 0
  }

  return {
    eligible,
    totalCashIn,
    refiLoanAmount,
    refiLTV: REFI_LTV,
    cashReturned,
    cashLeftInDeal,
    refiMonthlyPayment,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCash,
    equityCapture,
    refiCoverage,
    marketRent,
    totalOpex,
    dealScore: Math.min(100, Math.round(score)),
    notes,
  }
}
