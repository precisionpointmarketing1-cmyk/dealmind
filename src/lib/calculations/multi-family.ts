import { DealInput, MultiFamilyResult } from '@/types/deal'
import { DEFAULTS, CLOSING_COST_PCT } from '@/lib/utils/constants'
import { monthlyPayment } from '@/lib/utils/formatters'

export function calcMultiFamily(input: DealInput, rentPerUnit: number): MultiFamilyResult {
  const {
    askingPrice,
    estimatedARV,
    units = 1,
    downPaymentPct,
    interestRate,
    loanTermMonths,
    vacancyRate,
    mgmtFeePct,
    annualTaxes,
    annualInsurance,
    maintenanceReservePct,
    marketCapRate = DEFAULTS.MARKET_CAP_RATE,
  } = input

  const eligible = units >= 5

  const perUnitRent          = rentPerUnit
  const totalMonthlyRent     = rentPerUnit * units
  const grossRentAnnual      = totalMonthlyRent * 12
  const effectiveGrossIncome = grossRentAnnual * (1 - vacancyRate)

  const opExpenses =
    effectiveGrossIncome * mgmtFeePct +
    annualTaxes +
    annualInsurance +
    grossRentAnnual * maintenanceReservePct +
    grossRentAnnual * DEFAULTS.CAPEX_RESERVE_PCT

  const noi                  = effectiveGrossIncome - opExpenses
  const capRate              = askingPrice > 0 ? noi / askingPrice : 0
  const grossRentMultiplier  = grossRentAnnual > 0 ? askingPrice / grossRentAnnual : 0
  const expenseRatio         = grossRentAnnual > 0 ? opExpenses / grossRentAnnual : 0
  const valuationByCapRate   = marketCapRate > 0 ? noi / marketCapRate : 0

  // Financing
  const loanAmount       = askingPrice * (1 - downPaymentPct)
  const monthly          = monthlyPayment(loanAmount, interestRate, loanTermMonths)
  const annualDebtService = monthly * 12
  const dscr             = annualDebtService > 0 ? noi / annualDebtService : 99
  const cashFlow         = (noi - annualDebtService) / 12

  const downPayment  = askingPrice * downPaymentPct
  const closingCosts = askingPrice * CLOSING_COST_PCT
  const totalCashIn  = downPayment + closingCosts
  const cashOnCash   = totalCashIn > 0 ? ((noi - annualDebtService) / totalCashIn) : 0
  const perUnitValue = units > 0 ? askingPrice / units : 0

  // Break-even occupancy: what % occupancy covers debt + fixed opex
  const fixedAnnualCosts = annualTaxes + annualInsurance + annualDebtService
  const variableMargin   = grossRentAnnual > 0
    ? 1 - mgmtFeePct - maintenanceReservePct - DEFAULTS.CAPEX_RESERVE_PCT
    : 1
  const breakEvenOccupancy = grossRentAnnual > 0 && variableMargin > 0
    ? fixedAnnualCosts / (grossRentAnnual * variableMargin)
    : 1

  const notes: string[] = []

  if (!eligible) {
    notes.push('Multi-Family requires 5+ units (commercial). For 1-4 units consider BRRRR, Buy & Hold, or Airbnb.')
  }
  if (capRate > marketCapRate) {
    notes.push(`Cap rate ${(capRate * 100).toFixed(2)}% beats market ${(marketCapRate * 100).toFixed(2)}% — undervalued asset`)
  }
  if (valuationByCapRate > askingPrice) {
    notes.push(`Income-based valuation ${fmt(valuationByCapRate)} > asking — instant equity at market cap rate`)
  }
  if (dscr < DEFAULTS.MIN_DSCR) {
    notes.push(`DSCR ${dscr.toFixed(2)}x below 1.25x — lender will require higher NOI or larger down payment`)
  }
  if (units >= 5) {
    notes.push('5+ units: commercial financing — valued on income, not comps; DSCR is critical')
  }
  if (grossRentMultiplier < 8) {
    notes.push(`GRM of ${grossRentMultiplier.toFixed(1)}x is excellent — strong income relative to price`)
  }
  if (expenseRatio > 0.50) {
    notes.push(`High expense ratio of ${(expenseRatio * 100).toFixed(0)}% — negotiate lower price or reduce opex`)
  }
  if (breakEvenOccupancy < 0.70) {
    notes.push(`Break-even at only ${(breakEvenOccupancy * 100).toFixed(0)}% occupancy — very resilient to vacancies`)
  }

  let score = 0
  if (eligible) {
    score += 20
    score += capRate > DEFAULTS.MIN_CAP_RATE ? Math.min(30, (capRate / DEFAULTS.MIN_CAP_RATE) * 15) : 0
    score += dscr >= DEFAULTS.MIN_DSCR ? 20 : 0
    score += cashOnCash >= DEFAULTS.MIN_COC ? 20 : 0
    score += valuationByCapRate > askingPrice ? 10 : 0
  }

  return {
    eligible,
    units,
    perUnitValue,
    perUnitRent,
    totalMonthlyRent,
    grossRentMultiplier,
    effectiveGrossIncome,
    totalOpExpenses: opExpenses,
    expenseRatio,
    noi,
    capRate,
    dscr,
    cashFlow,
    cashOnCash,
    totalCashIn,
    breakEvenOccupancy: Math.min(1, breakEvenOccupancy),
    valuationByCapRate,
    dealScore: Math.min(100, Math.round(score)),
    notes,
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
