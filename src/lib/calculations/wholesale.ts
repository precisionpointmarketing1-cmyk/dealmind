import { DealInput, WholesaleResult } from '@/types/deal'
import { DEFAULTS, WHOLESALE_CLOSING_COST } from '@/lib/utils/constants'

export function calcWholesale(input: DealInput): WholesaleResult {
  const { estimatedARV, estimatedRepairs, existingLoanBalance = 0 } = input

  const lao                = estimatedARV * DEFAULTS.LAO_DISCOUNT - estimatedRepairs      // opening/target offer
  const mao                = estimatedARV * DEFAULTS.INVESTOR_DISCOUNT - estimatedRepairs  // ceiling
  const suggestedOfferPrice = lao  // lead with LAO as the opening offer

  // Assignment fee — capped by what the deal math can actually support.
  // End buyer equity = ARV * 0.30 - fee - closingCosts (repairs cancel out).
  // To keep end buyer equity >= MIN_WHOLESALE_SPREAD, fee can't exceed:
  const maxViableFee = Math.max(0,
    estimatedARV * (1 - DEFAULTS.INVESTOR_DISCOUNT) - WHOLESALE_CLOSING_COST - DEFAULTS.MIN_WHOLESALE_SPREAD
  )
  const targetFee = input.assignmentFee && input.assignmentFee > 0
    ? input.assignmentFee
    : DEFAULTS.MIN_WHOLESALE_SPREAD
  const wholesaleFee = Math.min(targetFee, maxViableFee)
  const feeReduced   = targetFee > wholesaleFee

  // End buyer pays our MAO + our assignment fee (+ standard closing costs)
  const endBuyerPrice = mao + wholesaleFee + WHOLESALE_CLOSING_COST

  // Deal is viable if the end buyer still has enough equity margin after repairs
  const endBuyerEquity = estimatedARV - endBuyerPrice - estimatedRepairs
  const eligible       = endBuyerEquity >= DEFAULTS.MIN_WHOLESALE_SPREAD

  // spreadToBuyer = our assignment fee (the profit we capture)
  const spreadToBuyer = wholesaleFee

  // ── Assignment Fee Metrics ────────────────────────────────────────────────
  const assignmentFeePctARV = estimatedARV > 0 ? wholesaleFee / estimatedARV : 0

  // ── End Buyer Position ────────────────────────────────────────────────────
  const endBuyerROI = endBuyerPrice > 0 ? endBuyerEquity / endBuyerPrice : 0

  // ── Earnest Money & ROI ───────────────────────────────────────────────────
  const estimatedEMD = input.emd ?? Math.min(5_000, Math.max(1_000, mao * 0.005))
  const roiOnEMD     = estimatedEMD > 0 ? wholesaleFee / estimatedEMD : 0

  const notes: string[] = []

  if (feeReduced) {
    notes.push(`Target fee of ${fmt(targetFee)} reduced to ${fmt(wholesaleFee)} — deal math only supports this much before end buyer equity drops below minimum`)
  }
  if (!eligible) {
    notes.push(`End buyer equity of ${fmt(endBuyerEquity)} after repairs is too thin — reduce assignment fee or find a cheaper acquisition`)
  }
  if (eligible && endBuyerEquity < 30_000) {
    notes.push(`End buyer equity of ${fmt(endBuyerEquity)} is thin — harder dispo; consider deeper discount`)
  }
  if (endBuyerROI > 0.20) {
    notes.push(`End buyer sees ${(endBuyerROI * 100).toFixed(0)}% return — strong buyer incentive, fast dispo`)
  }
  if (estimatedRepairs > 50_000) {
    notes.push('Heavy rehab — end buyer pool is smaller; target rehabbers not turnkey buyers')
  }
  if (wholesaleFee > 50_000) {
    notes.push('Large assignment fee — consider double-close to protect fee size')
  }
  if (assignmentFeePctARV > 0.05) {
    notes.push(`Fee is ${(assignmentFeePctARV * 100).toFixed(1)}% of ARV — verify title co allows assignment at this size`)
  }
  if (roiOnEMD > 5) {
    notes.push(`${roiOnEMD.toFixed(0)}x return on earnest money deposit — exceptional capital efficiency`)
  }

  // ── Payoff Analysis (from BatchLeads mortgage data) ───────────────────────
  if (existingLoanBalance > 0) {
    const sellerNetAtMAO = mao - existingLoanBalance
    if (sellerNetAtMAO >= 0) {
      notes.push(`Payoff: seller owes ${fmt(existingLoanBalance)} — at MAO of ${fmt(mao)}, seller walks with ${fmt(sellerNetAtMAO)} cash after payoff`)
    } else {
      notes.push(`⚠ Payoff problem: seller owes ${fmt(existingLoanBalance)} but MAO is only ${fmt(mao)} — seller is ${fmt(Math.abs(sellerNetAtMAO))} underwater at our number. Short sale or price reduction needed.`)
    }
    if (existingLoanBalance > mao * 0.85) {
      notes.push(`High LTV on existing loan — limited equity for seller concessions. Focus on non-price terms (timeline, as-is, certainty).`)
    }
  }

  let score = 0
  if (eligible) {
    score += 40
    score += Math.min(40, (spreadToBuyer / 1_000) * 0.8)
    score += spreadToBuyer > 30_000 ? 20 : spreadToBuyer > 20_000 ? 10 : 0
  }
  // Penalize if seller is underwater — harder to close at our number
  if (existingLoanBalance > 0 && existingLoanBalance > mao) {
    score = Math.max(0, score - 20)
  }

  return {
    eligible,
    lao,
    mao,
    suggestedOfferPrice,
    wholesaleFee,
    assignmentFeePctARV,
    endBuyerPrice,
    endBuyerEquity,
    endBuyerROI,
    estimatedEMD,
    roiOnEMD,
    arv: estimatedARV,
    repairCost: estimatedRepairs,
    spreadToBuyer,
    dealScore: Math.min(100, Math.round(score)),
    notes,
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
