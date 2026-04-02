import { AnalysisResult } from '@/types/deal'
import { DEFAULTS } from './constants'

/**
 * Returns a patched copy of result with updated repairs and recalculated
 * LAO / MAO / wholesale metrics. Used by report endpoints when the user has
 * adjusted the rehab budget on the dashboard after the initial analysis.
 */
export function patchRepairs(result: AnalysisResult, activeRepairs: number): AnalysisResult {
  const arv = result.arv.adjustedARV
  const newLao = Math.max(0, Math.round(arv * DEFAULTS.LAO_DISCOUNT      - activeRepairs))
  const newMao = Math.max(0, Math.round(arv * DEFAULTS.INVESTOR_DISCOUNT  - activeRepairs))

  return {
    ...result,
    input: {
      ...result.input,
      estimatedRepairs: activeRepairs,
    },
    coreMetrics: {
      ...result.coreMetrics,
      lao: newLao,
      mao: newMao,
    },
    wholesale: {
      ...result.wholesale,
      lao: newLao,
      mao: newMao,
      suggestedOfferPrice: newLao,
    },
  }
}
