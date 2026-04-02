import { DealInput, PrivateMoneyResult } from '@/types/deal'

export function calcPrivateMoney(input: DealInput, arv: number): PrivateMoneyResult {
  const purchase = input.askingPrice > 0 ? input.askingPrice : 0
  const repairs  = input.estimatedRepairs ?? 0
  const rate     = input.hardMoneyRate    ?? 0.12
  const points   = input.hardMoneyPoints  ?? 2.5
  const termMos  = input.hardMoneyTermMonths ?? 12

  // Two common underwriting approaches — take the lower
  const loanByARV = arv * 0.70
  const loanByLTC = purchase * 0.90 + repairs * 1.0
  const maxLoan   = Math.min(loanByARV, loanByLTC)

  const pointsCost           = maxLoan * (points / 100)
  const monthlyInterest      = maxLoan * (rate / 12)
  const totalInterest        = monthlyInterest * termMos
  const totalCostOfCapital   = pointsCost + totalInterest
  const closingCosts         = purchase * 0.025
  const cashRequiredToClose  = Math.max(0, purchase - maxLoan + closingCosts)
  const allInCost            = purchase + repairs + closingCosts
  const annualizedCostPct    = maxLoan > 0 ? totalCostOfCapital / maxLoan : 0
  const equity               = arv - allInCost

  const eligible = purchase > 0 && equity > 15000

  const dealScore = eligible ? Math.min(100, Math.round(
    (equity > 60000 ? 35 : equity > 35000 ? 25 : equity > 15000 ? 15 : 0) +
    (annualizedCostPct < 0.14 ? 25 : annualizedCostPct < 0.18 ? 15 : 8) +
    (cashRequiredToClose < purchase * 0.15 ? 25 : cashRequiredToClose < purchase * 0.25 ? 15 : 8) +
    (arv > allInCost * 1.25 ? 15 : arv > allInCost * 1.10 ? 8 : 0)
  )) : 0

  return {
    eligible,
    loanAmountByARV: loanByARV,
    loanAmountByLTC: loanByLTC,
    maxLoan,
    points,
    pointsCost,
    rate,
    monthlyInterest,
    holdingPeriodMonths: termMos,
    totalInterest,
    totalCostOfCapital,
    cashRequiredToClose,
    allInCost,
    annualizedCostPct,
    dealScore,
  }
}
