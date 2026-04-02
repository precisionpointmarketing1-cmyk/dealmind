import { DealInput, CommercialResult } from '@/types/deal'
import { DEFAULTS } from '@/lib/utils/constants'

export function calcCommercial(input: DealInput, marketRent: number): CommercialResult {
  const purchase    = input.askingPrice > 0 ? input.askingPrice : 0
  const sqft        = input.sqft ?? 0
  const annualNOI   = input.commercialAnnualNOI
    ?? Math.max(0, marketRent * 12 * 0.60)   // fallback: ~60% NOI margin on gross rent
  const mktCapRate  = input.marketCapRate ?? DEFAULTS.MARKET_CAP_RATE
  const downPct     = input.downPaymentPct ?? 0.25
  const rate        = input.interestRate   ?? DEFAULTS.INTEREST_RATE
  const termMos     = input.loanTermMonths ?? 300  // 25-yr commercial term

  const downPayment     = purchase * downPct
  const loanAmount      = purchase * (1 - downPct)
  const closingCosts    = purchase * 0.03
  const totalCashIn     = downPayment + closingCosts

  // Monthly P&I
  const mRate = rate / 12
  const annualDebtService = loanAmount > 0
    ? (loanAmount * mRate * Math.pow(1 + mRate, termMos)) / (Math.pow(1 + mRate, termMos) - 1) * 12
    : 0

  const dscr             = annualDebtService > 0 ? annualNOI / annualDebtService : 0
  const annualCashFlow   = annualNOI - annualDebtService
  const monthlyCashFlow  = annualCashFlow / 12
  const cashOnCash       = totalCashIn > 0 ? annualCashFlow / totalCashIn : 0
  const capRate          = purchase > 0 ? annualNOI / purchase : 0
  const valueByCapRate   = mktCapRate > 0 ? annualNOI / mktCapRate : 0
  const pricePerSqft     = sqft > 0 ? purchase / sqft : 0

  const eligible = purchase > 0 && annualNOI > 0

  const dealScore = eligible ? Math.min(100, Math.round(
    (capRate >= 0.08 ? 30 : capRate >= 0.06 ? 20 : capRate >= 0.04 ? 10 : 0) +
    (dscr >= 1.25 ? 30 : dscr >= 1.0 ? 20 : dscr >= 0.8 ? 8 : 0) +
    (cashOnCash >= 0.12 ? 25 : cashOnCash >= 0.08 ? 15 : cashOnCash >= 0.05 ? 8 : 0) +
    (valueByCapRate > purchase ? 15 : valueByCapRate > purchase * 0.9 ? 8 : 0)
  )) : 0

  return {
    eligible,
    purchasePrice: purchase,
    annualNOI,
    capRate,
    marketCapRate: mktCapRate,
    valueByCapRate,
    pricePerSqft,
    annualDebtService,
    dscr,
    annualCashFlow,
    monthlyCashFlow,
    cashOnCash,
    totalCashIn,
    dealScore,
  }
}
