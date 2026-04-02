import { DealInput, MobileHomeResult } from '@/types/deal'
import { DEFAULTS } from '@/lib/utils/constants'

export function calcMobileHome(input: DealInput, marketRent: number): MobileHomeResult {
  const purchase    = input.askingPrice > 0 ? input.askingPrice : 0
  const parkOwned   = input.mobileHomeParkOwned ?? false
  const lotRent     = parkOwned ? (input.mobileHomeLotRent ?? 500) : 0
  const vacancy     = input.vacancyRate ?? DEFAULTS.VACANCY_RATE
  const mgmt        = input.mgmtFeePct  ?? DEFAULTS.MGMT_FEE_PCT
  const maint       = DEFAULTS.MAINTENANCE_RESERVE_PCT

  const effectiveRent   = marketRent * (1 - vacancy)
  const netMonthlyRent  = effectiveRent - lotRent
  const monthlyExpenses = marketRent * (mgmt + maint) + (input.annualTaxes ?? 1200) / 12 + (input.annualInsurance ?? 600) / 12
  const monthlyCashFlow = netMonthlyRent - monthlyExpenses
  const annualCashFlow  = monthlyCashFlow * 12
  const annualNOI       = (netMonthlyRent - monthlyExpenses + lotRent) * 12  // NOI before lot rent deduction
  const allCashCapRate  = purchase > 0 ? (annualNOI - lotRent * 12) / purchase : 0
  const cashOnCash      = purchase > 0 ? annualCashFlow / purchase : 0  // all-cash assumption

  const eligible = purchase > 0 && marketRent > 0

  const dealScore = eligible ? Math.min(100, Math.round(
    (cashOnCash >= 0.15 ? 35 : cashOnCash >= 0.10 ? 25 : cashOnCash >= 0.06 ? 12 : 0) +
    (allCashCapRate >= 0.10 ? 30 : allCashCapRate >= 0.07 ? 20 : allCashCapRate >= 0.05 ? 10 : 0) +
    (monthlyCashFlow >= 300 ? 25 : monthlyCashFlow >= 150 ? 15 : monthlyCashFlow >= 0 ? 8 : 0) +
    (!parkOwned ? 10 : 5)  // land-owned is better
  )) : 0

  return {
    eligible,
    purchasePrice: purchase,
    parkOwned,
    monthlyLotRent: lotRent,
    marketRent,
    netMonthlyRent,
    monthlyExpenses,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCash,
    allCashCapRate,
    dealScore,
  }
}
