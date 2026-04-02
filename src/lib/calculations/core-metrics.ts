import { DealInput, CoreMetrics } from '@/types/deal'
import { DEFAULTS, CLOSING_COST_PCT } from '@/lib/utils/constants'
import { monthlyPayment } from '@/lib/utils/formatters'

export function calcCoreMetrics(input: DealInput, marketRent: number): CoreMetrics {
  const {
    askingPrice,
    estimatedARV,
    estimatedRepairs,
    downPaymentPct,
    interestRate,
    loanTermMonths,
    vacancyRate,
    mgmtFeePct,
    annualTaxes,
    annualInsurance,
    maintenanceReservePct,
    annualAppreciation = DEFAULTS.ANNUAL_APPRECIATION,
  } = input

  // ── LAO / MAO ─────────────────────────────────────────────────────────────
  const arvDiscount = estimatedARV * DEFAULTS.INVESTOR_DISCOUNT
  const mao = arvDiscount - estimatedRepairs                          // ceiling: ARV * 70% - repairs
  const lao = estimatedARV * DEFAULTS.LAO_DISCOUNT - estimatedRepairs // target: ARV * 60% - repairs
  const equityAtPurchase = estimatedARV - askingPrice

  // ── Income ────────────────────────────────────────────────────────────────
  const grossRentAnnual = marketRent * 12
  const effectiveGrossIncome = grossRentAnnual * (1 - vacancyRate)

  const opExpenses =
    effectiveGrossIncome * mgmtFeePct +
    annualTaxes +
    annualInsurance +
    grossRentAnnual * maintenanceReservePct +
    grossRentAnnual * DEFAULTS.CAPEX_RESERVE_PCT

  const noi = effectiveGrossIncome - opExpenses

  // ── Financing ─────────────────────────────────────────────────────────────
  const loanAmount = askingPrice * (1 - downPaymentPct)
  const monthly = monthlyPayment(loanAmount, interestRate, loanTermMonths)
  const annualDebtService = monthly * 12
  const downPayment = askingPrice * downPaymentPct
  const closingCosts = askingPrice * CLOSING_COST_PCT
  const totalCashInvested = downPayment + closingCosts + estimatedRepairs

  // ── Returns ───────────────────────────────────────────────────────────────
  const capRate = noi / askingPrice
  const grm = askingPrice / grossRentAnnual
  const annualCashFlow = noi - annualDebtService
  const monthlyCashFlow = annualCashFlow / 12
  const cashOnCashReturn = totalCashInvested > 0 ? annualCashFlow / totalCashInvested : 0
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 99
  const monthlyDebtService = monthly

  // ── 5-Year Wealth Build ───────────────────────────────────────────────────
  const appreciationAt5yr = estimatedARV * (Math.pow(1 + annualAppreciation, 5) - 1)
  const loanBalanceAt5yr = calcLoanBalance(loanAmount, interestRate, loanTermMonths, 60)
  const equityAt5yr = estimatedARV + appreciationAt5yr - loanBalanceAt5yr
  const totalProjectedReturn5yr = annualCashFlow * 5 + appreciationAt5yr

  return {
    lao,
    mao,
    arvDiscount,
    equityAtPurchase,
    grossRentAnnual,
    effectiveGrossIncome,
    operatingExpenses: opExpenses,
    noi,
    capRate,
    grm,
    cashOnCashReturn,
    dscr,
    annualDebtService,
    monthlyDebtService,
    loanAmount,
    purchasePrice: askingPrice,
    monthlyCashFlow,
    annualCashFlow,
    totalProjectedReturn5yr,
    equityAt5yr,
    appreciationAt5yr,
  }
}

function calcLoanBalance(principal: number, annualRate: number, totalMonths: number, paidMonths: number): number {
  if (annualRate === 0) return principal - (principal / totalMonths) * paidMonths
  const r = annualRate / 12
  const pmt = monthlyPayment(principal, annualRate, totalMonths)
  return principal * Math.pow(1 + r, paidMonths) - pmt * (Math.pow(1 + r, paidMonths) - 1) / r
}
