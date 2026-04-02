import { DealInput, OwnerFinanceResult } from '@/types/deal'
import { DEFAULTS } from '@/lib/utils/constants'
import { monthlyPayment } from '@/lib/utils/formatters'

// Remaining principal balance after `paidMonths` payments
function remainingBalance(principal: number, monthlyRate: number, totalMonths: number, paidMonths: number): number {
  if (monthlyRate === 0) return principal - (principal / totalMonths) * paidMonths
  return principal * Math.pow(1 + monthlyRate, paidMonths) -
    (monthlyPayment(principal, monthlyRate * 12, totalMonths)) *
    ((Math.pow(1 + monthlyRate, paidMonths) - 1) / monthlyRate)
}

export function calcOwnerFinance(input: DealInput, marketRent: number): OwnerFinanceResult {
  const {
    askingPrice,
    estimatedARV,
    downPaymentPct,
    interestRate,
    loanTermMonths,
    vacancyRate,
    mgmtFeePct,
    maintenanceReservePct,
    annualTaxes,
    annualInsurance,
  } = input

  // ── Seller-Carry Terms ────────────────────────────────────────────────────
  // Seller typically wants a slight rate premium above market for carrying the note
  const proposedRate       = interestRate + DEFAULTS.OWNER_FINANCE_RATE_PREMIUM
  const proposedTermMonths = loanTermMonths
  const downPayment        = askingPrice * downPaymentPct
  const sellerCarryAmount  = askingPrice - downPayment

  const monthlyPaymentToSeller = monthlyPayment(sellerCarryAmount, proposedRate, proposedTermMonths)

  // ── Balloon Payment (standard 5-yr balloon) ───────────────────────────────
  const balloonMonths  = 60 // 5-year balloon is industry standard
  const monthlyRate    = proposedRate / 12
  const balloonBalance = Math.max(0, remainingBalance(sellerCarryAmount, monthlyRate, proposedTermMonths, balloonMonths))

  // Total interest paid to seller until balloon (60 payments)
  const totalPaidUntilBalloon  = monthlyPaymentToSeller * balloonMonths
  const principalPaidAtBalloon = sellerCarryAmount - balloonBalance
  const totalInterestToSeller  = Math.max(0, totalPaidUntilBalloon - principalPaidAtBalloon)

  // Total seller return: down payment + all monthly payments + balloon payoff
  const sellerTotalReturn = downPayment + totalPaidUntilBalloon + balloonBalance

  // ── Cash Flow Analysis ────────────────────────────────────────────────────
  const monthlyRentNet  = marketRent * (1 - vacancyRate)
  const monthlyMgmt     = marketRent * mgmtFeePct
  const monthlyMaint    = marketRent * maintenanceReservePct
  const monthlyTaxIns   = (annualTaxes + annualInsurance) / 12
  const monthlyOpEx     = monthlyMgmt + monthlyMaint + monthlyTaxIns
  const monthlySpread   = monthlyRentNet - monthlyPaymentToSeller - monthlyOpEx
  const annualSpread    = monthlySpread * 12

  // Cash-on-cash: annual spread / down payment invested
  const cashOnCash      = downPayment > 0 ? annualSpread / downPayment : 0

  // What the seller earns on their held equity
  const yieldToSeller   = proposedRate

  const eligible = sellerCarryAmount > 0 && askingPrice < estimatedARV * 0.85

  const notes: string[] = []

  if (!eligible && askingPrice >= estimatedARV * 0.85) {
    notes.push('Asking price too close to ARV — seller has little incentive to carry the note')
  }
  if (downPaymentPct < 0.10) {
    notes.push(`Low down of ${(downPaymentPct * 100).toFixed(0)}% — sweeten with higher rate or shorter balloon to motivate seller`)
  }
  if (monthlySpread > 300) {
    notes.push(`Solid ${fmt(monthlySpread)}/mo spread after all expenses on seller-financed terms`)
  }
  if (balloonBalance > 0) {
    notes.push(`5-yr balloon: ${fmt(balloonBalance)} due at month 60 — plan refinance or resale exit`)
  }
  if (sellerTotalReturn > sellerCarryAmount * 1.4) {
    notes.push(`Seller earns ${fmt(sellerTotalReturn)} total — strong yield motivates negotiation`)
  }
  if (cashOnCash > 0.12) {
    notes.push(`${(cashOnCash * 100).toFixed(1)}% cash-on-cash — excellent return on down payment invested`)
  }
  if (proposedRate > 0.09) {
    notes.push('Rate above 9% — offer larger down payment to negotiate a lower carry rate')
  }

  let score = 0
  if (eligible) {
    score += 25
    score += Math.min(35, Math.max(0, monthlySpread / 10))
    score += downPaymentPct <= 0.10 ? 20 : downPaymentPct <= 0.20 ? 10 : 5
    score += yieldToSeller < 0.07 ? 20 : yieldToSeller < 0.09 ? 10 : 0
  }

  return {
    eligible,
    purchasePrice:          askingPrice,
    downPayment,
    sellerCarryAmount,
    proposedRate,
    proposedTermMonths,
    balloonMonths,
    balloonBalance:         Math.round(balloonBalance),
    totalInterestToSeller:  Math.round(totalInterestToSeller),
    sellerTotalReturn:      Math.round(sellerTotalReturn),
    monthlyPaymentToSeller,
    monthlyRentIncome:      monthlyRentNet,
    monthlyOpEx,
    monthlySpread,
    annualSpread,
    cashOnCash,
    yieldToSeller,
    dealScore: Math.min(100, Math.round(score)),
    notes,
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
