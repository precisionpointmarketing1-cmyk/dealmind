import { DealInput, SubjectToResult } from '@/types/deal'
import { DEFAULTS, CLOSING_COST_PCT } from '@/lib/utils/constants'
import { monthlyPayment } from '@/lib/utils/formatters'

/**
 * Subject-To Deal Calculator — Pace Morby methodology
 *
 * Key insight: the entry fee is NOT derived from the seller's asking price.
 * It is the maximum WE are willing to pay the seller (above their loan payoff)
 * to take deed and assume payments — determined by equity cushion and cash flow.
 *
 * Entry Fee components (Pace Morby):
 *   Seller Cash + Arrears + Closing Costs + Renovations + (Monthly Carrying × 2) + $1k marketing
 *
 * We calculate the RANGE: min (just costs to close) → max (equity cap + CF cap)
 * and surface the recommended entry fee as the sweet spot.
 */
export function calcSubjectTo(input: DealInput, marketRent: number): SubjectToResult {
  const {
    estimatedARV,
    estimatedRepairs = 0,
    existingLoanBalance = 0,
    existingMonthlyPITI = 0,
    existingInterestRate = 0,
    existingRemainingMonths = 0,
    vacancyRate,
    mgmtFeePct,
    annualTaxes,
    annualInsurance,
    maintenanceReservePct,
    interestRate,
    loanTermMonths,
    downPaymentPct,
  } = input

  const hasLoanData = existingLoanBalance > 0 && existingMonthlyPITI > 0

  if (!hasLoanData) {
    const zero: SubjectToResult = {
      eligible: false,
      existingLoanBalance: 0, existingMonthlyPITI: 0, existingRate: 0, remainingMonths: 0,
      entryFee: 0, maxEntryFee: 0, entryFeeMin: 0,
      closingCosts: 0, totalCashToClose: 0, acquisitionCost: 0,
      equitySpread: 0, equityCapture: 0, ltvRatio: 0, equityPct: 0,
      cashFlowUnfinanced: 0, cashFlowFinanced: 0, cashFlowWithSubTo: 0,
      privateLenderPayment: 0, breakEvenRent: 0, cashOnCash: 0,
      newLoanPayment: 0, rateSavingsMonthly: 0, paymentSpread: 0, lifetimeRateSavings: 0,
      wrapMonthlyPayment: 0, wrapPaymentSpread: 0,
      monthlyEquityBuildup: 0, vsNewFinancing: 0,
      dealScore: 0,
      notes: ['Upload the seller\'s mortgage statement or enter loan details manually to evaluate Subject-To'],
    }
    return zero
  }

  // ── Equity Position ───────────────────────────────────────────────────────
  const equitySpread  = Math.max(0, estimatedARV - existingLoanBalance)
  const equityPct     = estimatedARV > 0 ? equitySpread / estimatedARV : 0
  const ltvRatio      = estimatedARV > 0 ? existingLoanBalance / estimatedARV : 0

  const eligible =
    existingLoanBalance > 0 &&
    existingMonthlyPITI > 0 &&
    equityPct >= DEFAULTS.EQUITY_CUSHION_MIN

  // ── Standard Closing Costs ────────────────────────────────────────────────
  // Flat estimate — title fees, escrow, recording, etc. (~$3k-$5k typical)
  const closingCosts = Math.round(Math.max(3_000, existingLoanBalance * CLOSING_COST_PCT))

  // ── Monthly Carrying Costs (Pace: × 2 months buffer) ─────────────────────
  const monthlyMgmt        = marketRent > 0 ? marketRent * mgmtFeePct : existingMonthlyPITI * 0.10
  const monthlyMaintenance = marketRent > 0 ? marketRent * maintenanceReservePct : existingMonthlyPITI * 0.05
  const monthlyVacancy     = marketRent > 0 ? marketRent * vacancyRate : 0
  const monthlyCarry       = existingMonthlyPITI + monthlyMgmt + monthlyMaintenance  // bare carry per month
  const carryBuffer        = monthlyCarry * 2   // Pace's standard 2-month buffer

  // ── Entry Fee Range ───────────────────────────────────────────────────────
  // Floor: just closing costs + carry buffer + $1k marketing (minimum to acquire)
  const entryFeeMin = Math.round(closingCosts + carryBuffer + 1_000)

  // Equity cap: keep at least 20% equity after entry fee, repairs, and closing
  //   ARV × 0.80 − loanBalance − repairs − closingCosts
  const entryFeeEquityCap = Math.max(0,
    Math.round(estimatedARV * 0.80 - existingLoanBalance - estimatedRepairs - closingCosts)
  )

  // Cash flow cap: max entry fee where FINANCED cash flow ≥ $0
  //   cashFlowUnfinanced = rent - PITI - expenses
  //   privateLender I/O = entryFee × 10% / 12
  //   cashFlowFinanced = cashFlowUnfinanced - (entryFee × 0.10 / 12) ≥ 0
  //   → entryFee ≤ cashFlowUnfinanced × 12 / 0.10
  const cashFlowBase = marketRent - existingMonthlyPITI - monthlyMgmt - monthlyMaintenance - monthlyVacancy
  const entryFeeCFCap = cashFlowBase > 0 ? Math.round(cashFlowBase * 12 / 0.10) : 0

  // Recommended entry fee = the LOWER of equity cap and CF cap, capped at equity spread
  // This is the MAX we'd pay the seller — never driven by their asking price
  const maxEntryFee = Math.min(entryFeeEquityCap, entryFeeCFCap > 0 ? entryFeeCFCap : entryFeeEquityCap)
  const recommendedEntryFee = Math.max(0, Math.min(maxEntryFee, equitySpread * 0.30)) // sweet spot: up to 30% of equity spread

  // Use recommended entry fee unless it's below the floor (deal may not be viable)
  const entryFee        = Math.max(entryFeeMin, recommendedEntryFee)
  const totalCashToClose = entryFee + closingCosts

  // ── Cash Flow Scenarios ───────────────────────────────────────────────────
  // 1. Unfinanced: entry fee paid from own cash
  const cashFlowUnfinanced = cashFlowBase  // rent - PITI - mgmt - maint - vacancy

  // 2. Financed: entry fee borrowed from private lender @ 10% interest-only
  const privateLenderPayment = Math.round(entryFee * 0.10 / 12)
  const cashFlowFinanced     = cashFlowUnfinanced - privateLenderPayment

  // Break-even: min gross rent where unfinanced cash flow = $0
  const fixedMonthly  = existingMonthlyPITI + monthlyMgmt + monthlyMaintenance
  const breakEvenRent = vacancyRate < 1 ? Math.round(fixedMonthly / (1 - vacancyRate)) : fixedMonthly

  // Cash-on-cash return (unfinanced basis)
  const cashOnCash = totalCashToClose > 0 ? (cashFlowUnfinanced * 12) / totalCashToClose : 0

  // ── Equity Capture ────────────────────────────────────────────────────────
  const equityCapture = Math.max(0, estimatedARV - existingLoanBalance - entryFee - estimatedRepairs)

  // ── Rate Advantage vs New Financing ───────────────────────────────────────
  // What a new conventional loan on the SAME property would cost
  const newLoanAmount    = estimatedARV * (1 - downPaymentPct)
  const newLoanPayment   = monthlyPayment(newLoanAmount, interestRate, loanTermMonths)
  const monthlyTaxIns    = (annualTaxes + annualInsurance) / 12
  const newLoanPITI      = newLoanPayment + monthlyTaxIns

  const rateSavingsMonthly  = Math.round(newLoanPITI - existingMonthlyPITI)
  const paymentSpread       = rateSavingsMonthly  // Pace's term
  const remainingMonths     = existingRemainingMonths > 0 ? existingRemainingMonths : loanTermMonths
  const lifetimeRateSavings = Math.round(rateSavingsMonthly * remainingMonths)

  const cashFlowNewFinancing =
    marketRent - monthlyVacancy - newLoanPayment - monthlyMgmt - monthlyMaintenance - monthlyTaxIns
  const vsNewFinancing = cashFlowUnfinanced - cashFlowNewFinancing

  // ── Wraparound Potential ───────────────────────────────────────────────────
  // If we resell on a wrap note at 8% / 30yr on 90% of ARV
  const wrapLoanAmount      = Math.round(estimatedARV * 0.90)
  const wrapMonthlyPayment  = Math.round(monthlyPayment(wrapLoanAmount, 0.08, 360))
  const wrapPaymentSpread   = Math.round(wrapMonthlyPayment - existingMonthlyPITI)  // monthly profit on wrap

  // ── Monthly Equity Buildup (principal portion of inherited payment) ────────
  const monthlyEquityBuildup =
    existingLoanBalance > 0 && existingInterestRate > 0
      ? Math.max(0, existingMonthlyPITI - (existingLoanBalance * existingInterestRate / 12))
      : 0

  // ── Notes & Score ─────────────────────────────────────────────────────────
  const notes: string[] = []

  if (existingInterestRate > 0 && existingInterestRate < interestRate - 0.005) {
    notes.push(`Rate lock: inherited ${(existingInterestRate * 100).toFixed(2)}% vs today's ${(interestRate * 100).toFixed(2)}% saves ${fmt(rateSavingsMonthly)}/mo (${fmt(lifetimeRateSavings)} lifetime)`)
  }
  if (cashFlowUnfinanced > 0) {
    notes.push(`Cash flow: ${fmt(cashFlowUnfinanced)}/mo unfinanced · ${fmt(cashFlowFinanced)}/mo with private money on entry fee`)
  } else if (cashFlowUnfinanced > -200) {
    notes.push(`Cash flow near break-even at ${fmt(cashFlowUnfinanced)}/mo — negotiate PITI down or increase rent`)
  } else {
    notes.push(`Negative cash flow ${fmt(cashFlowUnfinanced)}/mo at current rent — verify market rent or reduce entry fee`)
  }
  if (entryFee <= 10_000) {
    notes.push(`Low entry fee of ${fmt(entryFee)} — high capital efficiency; easy to fund with private money`)
  } else if (entryFee <= 25_000) {
    notes.push(`Entry fee of ${fmt(entryFee)} — viable range; consider private lender to fund at close`)
  } else {
    notes.push(`Entry fee of ${fmt(entryFee)} is substantial — negotiate seller down or structure hybrid sub-to + seller finance`)
  }
  if (equityCapture > 50_000) {
    notes.push(`Excellent instant equity of ${fmt(equityCapture)} — strong downside protection`)
  } else if (equityCapture > 20_000) {
    notes.push(`Solid equity capture of ${fmt(equityCapture)}`)
  }
  if (wrapPaymentSpread > 300) {
    notes.push(`Wrap opportunity: sell on ${fmt(wrapMonthlyPayment)}/mo wrap note — ${fmt(wrapPaymentSpread)}/mo spread`)
  }
  if (!eligible && equityPct < DEFAULTS.EQUITY_CUSHION_MIN) {
    notes.push(`Only ${(equityPct * 100).toFixed(1)}% equity — sub-to risky below ${DEFAULTS.EQUITY_CUSHION_MIN * 100}% cushion; ensure strong cash flow`)
  }

  let score = 0
  if (hasLoanData) {
    if (eligible) score += 25
    score += cashFlowUnfinanced > 300 ? 25 : cashFlowUnfinanced > 100 ? 15 : cashFlowUnfinanced > 0 ? 8 : 0
    score += vsNewFinancing > 200 ? 20 : vsNewFinancing > 0 ? 10 : 0
    score += existingInterestRate > 0 && existingInterestRate < interestRate - 0.005 ? 20 : 0
    score += equityCapture > 40_000 ? 10 : equityCapture > 20_000 ? 5 : 0
  }

  return {
    eligible,
    existingLoanBalance,
    existingMonthlyPITI,
    existingRate: existingInterestRate,
    remainingMonths,
    entryFee,
    maxEntryFee,
    entryFeeMin,
    closingCosts,
    totalCashToClose,
    acquisitionCost: totalCashToClose,
    equitySpread,
    equityCapture,
    ltvRatio,
    equityPct,
    cashFlowUnfinanced,
    cashFlowFinanced,
    cashFlowWithSubTo: cashFlowUnfinanced,   // backward compat
    privateLenderPayment,
    breakEvenRent,
    cashOnCash,
    newLoanPayment: Math.round(newLoanPITI),
    rateSavingsMonthly,
    paymentSpread,
    lifetimeRateSavings,
    wrapMonthlyPayment,
    wrapPaymentSpread,
    monthlyEquityBuildup: Math.round(monthlyEquityBuildup),
    vsNewFinancing,
    dealScore: Math.min(100, Math.round(score)),
    notes,
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
