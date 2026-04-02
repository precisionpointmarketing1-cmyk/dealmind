import Anthropic from '@anthropic-ai/sdk'
import { DealInput, AnalysisResult, AIAnalysis, MarketGrade, StrategyRank, GradeLevel } from '@/types/deal'
import { fmt } from '@/lib/utils/formatters'
import { STRATEGY_LABELS } from '@/lib/utils/constants'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function analyzeWithAI(result: Partial<AnalysisResult>): Promise<AIAnalysis> {
  const { input, coreMetrics, wholesale, subjectTo, ownerFinance, multiFamily, airbnb, arv, marketData } = result

  if (!input || !coreMetrics) throw new Error('Missing input or coreMetrics for AI analysis')

  const prompt = buildPrompt(input, result)

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
    system: SYSTEM_PROMPT,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  return parseAIResponse(text, result)
}

const SYSTEM_PROMPT = `You are DealMind AI — an expert off-market real estate investment analyst with 20+ years of experience.
You specialize in creative financing, wholesale deals, subject-to acquisitions, BRRRR, and all major exit strategies.
You analyze deals with a seasoned investor's eye: direct, data-driven, and ruthlessly honest.
Your written summaries are detailed and actionable — you explain the full picture: seller situation, market conditions, acquisition approach, exit plan, and risk assessment.

For negotiationTips, think like a top-producing wholesaler trained by Steven Trang. Your job is to help the acquisitions team close this specific seller. Follow these principles:

UNCOVERING MOTIVATION: Before any price talk, find the "why." Ask open-ended questions — "What's making you think about selling now?" "How long have you owned it?" "What would happen if you didn't sell?" Listen for pain: divorce, probate, tired landlord, financial stress, health issue, vacant property. The pain IS the leverage.

IF PRICE IS OVER MAO (seller is too high): The goal is a controlled price reduction. Never argue about price — reframe around condition, repairs, and timeline. Use the "3 pillars" — if they won't move on price, probe timeline and condition. "If I could close in 2 weeks, cash, as-is, would that have any value to you?" Use comps and repair costs as neutral third-party proof, not personal opinion. The repair walkthrough is your biggest price reduction tool — present it factually: "The roof, HVAC, and foundation together will run $X — that has to come off the top." Anchoring: make your first offer BELOW your MAO so you have room to come up as a "concession." Never make a counter without getting something back.

IF PRICE IS UNDER MAO (deal is in the money): Build urgency to close. "We can have a contract to you today." Protect the deal — don't renegotiate down, get it locked up fast. Focus on certainty, speed, and zero hassle vs. listing with an agent.

CLOSING: End every conversation with a committed next step. "If I can get you a number that works, can we move forward this week?" Always get a yes/no — never leave it open. Follow up with a specific date and time.

Every tip must reference the actual numbers from this deal (asking price, MAO, repair budget, price gap). No generic advice.
Always return a valid JSON object matching the requested schema. No markdown, no explanations outside the JSON.`

function buildPrompt(input: DealInput, result: Partial<AnalysisResult>): string {
  const { coreMetrics: m, wholesale: w, subjectTo: s, airbnb: a, marketData, arv, rentComps } = result
  const brrrr = (result as any).brrrr
  const privateMoney = (result as any).privateMoney

  const askingVsMAO  = input.askingPrice > 0 && m?.mao ? input.askingPrice - m.mao : null
  const arvVsAsking  = input.estimatedARV > 0 && input.askingPrice > 0 ? input.estimatedARV - input.askingPrice : null
  const rentComp     = rentComps?.rentAvg ?? 0
  const ltvSubTo     = s?.existingLoanBalance && input.estimatedARV > 0 ? s.existingLoanBalance / input.estimatedARV : null

  const priceGap     = input.askingPrice > 0 && m?.mao ? input.askingPrice - m.mao : null
  const priceTooHigh = priceGap !== null && priceGap > 0

  return `Analyze this real estate deal and return a comprehensive JSON AIAnalysis object.

PROPERTY: ${input.address}, ${input.city}, ${input.state} ${input.zip}
Type: ${input.propertyType} | ${input.bedrooms}bd/${input.bathrooms}ba | ${input.sqft?.toLocaleString()} sqft | Built ${input.yearBuilt}

DEAL FINANCIALS:
- Asking Price: ${fmt.currency(input.askingPrice)} ${askingVsMAO !== null ? `(${askingVsMAO > 0 ? '+' + fmt.currency(askingVsMAO) + ' OVER MAO' : fmt.currency(Math.abs(askingVsMAO)) + ' UNDER MAO'})` : ''}
- Estimated ARV: ${fmt.currency(input.estimatedARV)} ${arvVsAsking !== null ? `(${fmt.currency(arvVsAsking)} equity spread)` : ''}
- Repair Budget: ${fmt.currency(input.estimatedRepairs)}
- MAO (70% Rule): ${fmt.currency(m?.mao ?? 0)}
- Equity at Purchase: ${fmt.currency(m?.equityAtPurchase ?? 0)}
- Market Rent: ${rentComp > 0 ? fmt.currency(rentComp) + '/mo' : 'unknown'}
${arv ? `- Consensus ARV (${arv.compsUsed} comps, ${arv.confidence} confidence): ${fmt.currency(arv.adjustedARV)}` : ''}
${priceTooHigh ? `- PRICE GAP WARNING: Seller is asking ${fmt.currency(priceGap!)} OVER our MAO. Need a ${((priceGap! / input.askingPrice) * 100).toFixed(0)}% price reduction to get to MAO. Seller must be brought down.` : priceGap !== null ? `- PRICE POSITION: Seller is ${fmt.currency(Math.abs(priceGap))} UNDER our MAO — deal is in the money.` : ''}

INVESTMENT METRICS:
- Cap Rate: ${fmt.pct(m?.capRate ?? 0)} ${(m?.capRate ?? 0) >= 0.07 ? '✓ strong' : (m?.capRate ?? 0) >= 0.05 ? '~ acceptable' : '✗ weak'}
- Cash-on-Cash: ${fmt.pct(m?.cashOnCashReturn ?? 0)}
- Monthly Cash Flow: ${fmt.currency(m?.monthlyCashFlow ?? 0)}/mo
- DSCR: ${(m?.dscr ?? 0).toFixed(2)}x ${(m?.dscr ?? 0) >= 1.25 ? '✓ strong' : (m?.dscr ?? 0) >= 1.0 ? '~ qualifies' : '✗ under 1.0'}
- NOI: ${fmt.currency(m?.noi ?? 0)}/yr
- GRM: ${(m?.grm ?? 0).toFixed(1)}x
- 5-yr Projected Return: ${fmt.currency(m?.totalProjectedReturn5yr ?? 0)}

ACQUISITION STRATEGY ANALYSIS:
- Cash Offer / Wholesale: ${w?.dealScore ?? 0}/100 | Eligible: ${w?.eligible} | MAO: ${fmt.currency(w?.mao ?? 0)} | Assignment Fee: ${fmt.currency(w?.wholesaleFee ?? 0)} | End Buyer ROI: ${((w?.endBuyerROI ?? 0) * 100).toFixed(0)}%
- Subject-To: ${s?.dealScore ?? 0}/100 | Eligible: ${s?.eligible} | Existing Balance: ${fmt.currency(s?.existingLoanBalance ?? 0)} | Existing Rate: ${s?.existingRate ? ((s.existingRate) * 100).toFixed(2) + '%' : 'N/A'} | LTV: ${ltvSubTo ? (ltvSubTo * 100).toFixed(0) + '%' : 'N/A'} | Monthly Cash Flow: ${fmt.currency(s?.cashFlowWithSubTo ?? 0)}/mo | Cash to Close: ${fmt.currency(s?.totalCashToClose ?? 0)}

INVESTOR FINANCING ANALYSIS:
- DSCR/Buy-Hold: score ${a?.dealScore ?? 0}/100 | LTR DSCR: ${(a?.ltrDSCR ?? 0).toFixed(2)}x | LTR Cash Flow: ${fmt.currency(a?.ltrMonthlyCashFlow ?? 0)}/mo | LTR CoC: ${fmt.pct(a?.ltrCashOnCash ?? 0)} | STR Revenue: ${fmt.currency(a?.monthlyRevenue ?? 0)}/mo | STR Net: ${fmt.currency(a?.monthlyNetIncome ?? 0)}/mo
- BRRRR: ${brrrr?.dealScore ?? 0}/100 | Eligible: ${brrrr?.eligible} | Cash In: ${fmt.currency(brrrr?.totalCashIn ?? 0)} | Cash Returned at Refi: ${fmt.currency(brrrr?.cashReturned ?? 0)} | Cash Left: ${fmt.currency(brrrr?.cashLeftInDeal ?? 0)} | Post-Refi Cash Flow: ${fmt.currency(brrrr?.monthlyCashFlow ?? 0)}/mo
- Private Money / Hard Money: ${privateMoney?.dealScore ?? 0}/100 | Loan: ${fmt.currency(privateMoney?.maxLoan ?? 0)} | Points: ${privateMoney?.points ?? 2.5}% | Monthly Interest: ${fmt.currency(privateMoney?.monthlyInterest ?? 0)}/mo | Total CoC: ${fmt.currency(privateMoney?.totalCostOfCapital ?? 0)}

${marketData ? `MARKET DATA (${input.zip}):
- Avg Rent: ${fmt.currency(marketData.averageRent)}/mo | Rent Growth: ${fmt.pct(marketData.rentGrowthPct ?? 0)}/yr | Vacancy: ${fmt.pct(marketData.vacancyRate ?? 0)} | Avg DOM: ${marketData.demandScore ?? 'N/A'} days` : 'Market data: not available'}

STRATEGY RANKING RULES (must follow):
- "listing" should only rank in top 3 when repairs are LOW (under $15k). Retail buyers need a move-in ready home — high repair costs mean the seller cannot list without fixing it first, which most sellers can't do. If repairs exceed $25k, rank "listing" no higher than 5th. If repairs exceed $50k, rank it last.
- "wholesale" and "cash-offer" should rank highest when repairs are high and equity spread is wide — this is the bread and butter for distressed properties.
- Never give "listing" a score above 60 when repair budget is over $30k.

Return this exact JSON schema (no markdown, no extra text):
{
  "dealSummary": "5-7 sentence comprehensive deal thesis covering the property, financials, equity position, market conditions, and overall investment quality",
  "sellerProfile": "2-3 sentences analyzing the seller's likely situation, motivation, and negotiating position based on asking price vs MAO, property condition, and market context",
  "acquisitionAnalysis": "2-3 sentences explaining the recommended acquisition approach (cash offer / subject-to / listing), why it works for this deal, and what cash is needed to close",
  "marketAnalysis": "2-3 sentences on zip code market conditions, rent trends, supply/demand dynamics, and whether it's a good time/market to acquire",
  "exitAnalysis": "2-3 sentences on the best exit strategy (hold/flip/BRRRR/STR), projected returns, timeline, and what needs to go right for the deal to perform",
  "recommendedStrategy": "cash-offer|subject-to|listing|wholesale|airbnb|buy-hold|brrrr|private-money",
  "strategyRankings": [
    { "strategy": "cash-offer|subject-to|listing|wholesale|airbnb|buy-hold|brrrr|private-money", "rank": 1, "score": 85, "rationale": "2 sentence specific rationale with numbers", "projectedROI": 0.15, "riskLevel": "low|medium|high" }
  ],
  "marketGrade": {
    "overall": "B+",
    "marketConditions": "B",
    "localMarket": "A-",
    "populationTrend": "B+",
    "rentGrowth": "A",
    "supplyDemand": "B",
    "summary": "2-3 sentence market grade summary",
    "bullPoints": ["specific bull point with data", "second bull point"],
    "bearPoints": ["specific bear point with data", "second bear point"]
  },
  "keyRisks": ["specific risk with detail", "second risk", "third risk", "fourth risk"],
  "keyOpportunities": ["specific opportunity with numbers", "second opportunity", "third opportunity"],
  "negotiationTips": [
    "First tip — written as a coaching instruction to the acquisitions rep, referencing this specific deal's numbers (asking price, MAO, repair gap). If seller is over MAO, this tip is about opening the price reduction conversation.",
    "Second tip — a specific question or tactic to use with this seller based on their likely motivation.",
    "Third tip — how to use the repair estimate or comps as neutral third-party proof to justify the number.",
    "Fourth tip — objection handling for the most likely pushback this seller will give.",
    "Fifth tip — how to close or get a committed next step from this seller."
  ],
  "redFlags": ["red flag if any — leave empty array if none"],
  "aiConfidence": 78,
  "arvEstimate": 285000
}`
}

function parseAIResponse(text: string, result: Partial<AnalysisResult>): AIAnalysis {
  try {
    const parsed = JSON.parse(text)
    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    }
  } catch {
    // Fallback if JSON parse fails
    const scores = {
      wholesale: result.wholesale?.dealScore ?? 0,
      'subject-to': result.subjectTo?.dealScore ?? 0,
      'owner-finance': result.ownerFinance?.dealScore ?? 0,
      'multi-family': result.multiFamily?.dealScore ?? 0,
      airbnb: result.airbnb?.dealScore ?? 0,
      'buy-hold': 50,
    }

    const ranked = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([strategy, score], i): StrategyRank => ({
        strategy: strategy as any,
        rank: i + 1,
        score,
        rationale: 'Based on quantitative scoring',
        projectedROI: score / 500,
        riskLevel: score > 70 ? 'low' : score > 40 ? 'medium' : 'high',
      }))

    return {
      dealSummary: 'Analysis complete. Review strategy scores for recommendations.',
      recommendedStrategy: ranked[0].strategy,
      strategyRankings: ranked,
      marketGrade: buildFallbackGrade(),
      keyRisks: ['Verify repair estimates', 'Confirm market rents'],
      keyOpportunities: ['Below market acquisition potential'],
      negotiationTips: [
        'Ask "What made you decide to reach out now?" — let them tell you the real why before you say anything about price.',
        'After presenting your number, stay silent. The first person to speak loses. Let the seller process.',
        'When they push back on price, ask "What would you need to see to feel good about this number?" — curiosity beats defense.',
        'Find their timeline. A seller with urgency will negotiate on price; a seller with none will not. Know which you have.',
        'End every call with a micro-commitment: "Can I follow up Thursday once you\'ve thought it over?" — never leave without a next step.',
      ],
      redFlags: [],
      aiConfidence: 50,
      generatedAt: new Date().toISOString(),
    }
  }
}

function buildFallbackGrade(): MarketGrade {
  return {
    overall: 'B' as GradeLevel,
    marketConditions: 'B' as GradeLevel,
    localMarket: 'B' as GradeLevel,
    populationTrend: 'B' as GradeLevel,
    rentGrowth: 'B' as GradeLevel,
    supplyDemand: 'B' as GradeLevel,
    summary: 'Market analysis pending',
    bullPoints: [],
    bearPoints: [],
  }
}
