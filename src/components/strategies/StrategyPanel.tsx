import { AnalysisResult, ExitStrategy, StrategyRank, BRRRRResult, AirbnbResult } from '@/types/deal'
import { fmt } from '@/lib/utils/formatters'
import { STRATEGY_LABELS } from '@/lib/utils/constants'

interface Props {
  strategy: ExitStrategy
  rank: number
  result: AnalysisResult
  aiRank?: StrategyRank
}

const ICONS: Record<ExitStrategy, string> = {
  wholesale:        '💸',
  'subject-to':     '🔑',
  'owner-finance':  '🤝',
  'multi-family':   '🏢',
  airbnb:           '🏦',
  'buy-hold':       '📈',
  brrrr:            '🔄',
  'private-money':  '💰',
  'cash-offer':     '💵',
  'listing':        '🏷️',
}

const SCORE_BAR_COLOR = (s: number) =>
  s >= 70 ? 'bg-cyan-500' : s >= 40 ? 'bg-yellow-500' : 'bg-red-500'

interface StatLine {
  label: string
  value: string
  highlight?: boolean // cyan accent for key numbers
}

export default function StrategyPanel({ strategy, rank, result, aiRank }: Props) {
  const { wholesale, subjectTo, ownerFinance, multiFamily, airbnb, brrrr, coreMetrics, privateMoney, commercial, mobileHome } = result
  const b = brrrr as BRRRRResult
  const a = airbnb as AirbnbResult

  const dataMap: Record<ExitStrategy, { score: number; eligible: boolean; lines: StatLine[] }> = {
    wholesale: {
      score:   wholesale.dealScore,
      eligible: wholesale.eligible,
      lines: [
        { label: 'MAO',                  value: fmt.currency(wholesale.mao),             highlight: true },
        { label: 'Suggested Offer',      value: fmt.currency(wholesale.suggestedOfferPrice) },
        { label: 'Assignment Fee',       value: fmt.currency(wholesale.wholesaleFee),    highlight: true },
        { label: 'Fee % of ARV',         value: `${(wholesale.assignmentFeePctARV * 100).toFixed(1)}%` },
        { label: 'End Buyer Price',      value: fmt.currency(wholesale.endBuyerPrice) },
        { label: 'End Buyer Equity',     value: fmt.currency(wholesale.endBuyerEquity) },
        { label: 'End Buyer ROI',        value: `${(wholesale.endBuyerROI * 100).toFixed(0)}%` },
        { label: 'Spread to Buyer',      value: fmt.currency(wholesale.spreadToBuyer) },
        { label: 'Earnest Money (EMD)',   value: fmt.currency(wholesale.estimatedEMD) },
        { label: 'ROI on EMD',           value: `${wholesale.roiOnEMD.toFixed(1)}x`,    highlight: wholesale.roiOnEMD > 5 },
      ],
    },

    'subject-to': {
      score:   subjectTo.dealScore,
      eligible: subjectTo.eligible,
      lines: [
        { label: 'Entry Fee to Seller',  value: fmt.currency(subjectTo.entryFee),        highlight: true },
        { label: 'Closing Costs',        value: fmt.currency(subjectTo.closingCosts) },
        { label: 'Total Cash to Close',  value: fmt.currency(subjectTo.totalCashToClose), highlight: true },
        { label: 'Existing Balance',     value: fmt.currency(subjectTo.existingLoanBalance) },
        { label: 'Existing PITI',        value: `${fmt.currency(subjectTo.existingMonthlyPITI)}/mo` },
        { label: 'Existing Rate',        value: subjectTo.existingRate > 0 ? `${(subjectTo.existingRate * 100).toFixed(2)}%` : '—' },
        { label: 'Rate Savings',         value: subjectTo.rateSavingsMonthly > 0 ? `${fmt.currency(subjectTo.rateSavingsMonthly)}/mo` : '—', highlight: subjectTo.rateSavingsMonthly > 200 },
        { label: 'LTV Ratio',            value: subjectTo.existingLoanBalance > 0 ? `${(subjectTo.ltvRatio * 100).toFixed(1)}%` : '—' },
        { label: 'Equity Capture',       value: subjectTo.equityCapture > 0 ? fmt.currency(subjectTo.equityCapture) : '—' },
        { label: 'Cash Flow',            value: `${fmt.currency(subjectTo.cashFlowWithSubTo)}/mo`,  highlight: subjectTo.cashFlowWithSubTo > 0 },
        { label: 'vs New Financing',     value: `+${fmt.currency(subjectTo.vsNewFinancing)}/mo` },
        { label: 'Break-Even Rent',      value: `${fmt.currency(subjectTo.breakEvenRent)}/mo` },
        { label: 'Cash-on-Cash',         value: `${(subjectTo.cashOnCash * 100).toFixed(1)}%`,      highlight: subjectTo.cashOnCash > 0.10 },
      ],
    },

    'owner-finance': {
      score:   ownerFinance.dealScore,
      eligible: ownerFinance.eligible,
      lines: [
        { label: 'Down Payment',         value: fmt.currency(ownerFinance.downPayment),               highlight: true },
        { label: 'Seller Carry',         value: fmt.currency(ownerFinance.sellerCarryAmount) },
        { label: 'Rate to Seller',       value: `${(ownerFinance.proposedRate * 100).toFixed(2)}%` },
        { label: 'Pmt to Seller',        value: `${fmt.currency(ownerFinance.monthlyPaymentToSeller)}/mo` },
        { label: '5-Yr Balloon',         value: fmt.currency(ownerFinance.balloonBalance),            highlight: true },
        { label: 'Interest to Seller',   value: fmt.currency(ownerFinance.totalInterestToSeller) },
        { label: 'Seller Total Return',  value: fmt.currency(ownerFinance.sellerTotalReturn) },
        { label: 'Monthly Spread',       value: `${fmt.currency(ownerFinance.monthlySpread)}/mo`,     highlight: ownerFinance.monthlySpread > 200 },
        { label: 'Annual Spread',        value: `${fmt.currency(ownerFinance.annualSpread)}/yr` },
        { label: 'Cash-on-Cash',         value: `${(ownerFinance.cashOnCash * 100).toFixed(1)}%`,    highlight: ownerFinance.cashOnCash > 0.10 },
      ],
    },

    'multi-family': {
      score:   multiFamily.dealScore,
      eligible: multiFamily.eligible,
      lines: [
        { label: 'Units',                value: String(multiFamily.units) },
        { label: 'Rent / Unit',          value: `${fmt.currency(multiFamily.perUnitRent)}/mo` },
        { label: 'Total Monthly Rent',   value: `${fmt.currency(multiFamily.totalMonthlyRent)}/mo`,  highlight: true },
        { label: 'NOI',                  value: `${fmt.currency(multiFamily.noi)}/yr`,               highlight: true },
        { label: 'Cap Rate',             value: `${(multiFamily.capRate * 100).toFixed(2)}%` },
        { label: 'GRM',                  value: `${multiFamily.grossRentMultiplier.toFixed(1)}x` },
        { label: 'DSCR',                 value: `${multiFamily.dscr.toFixed(2)}x`,                  highlight: multiFamily.dscr >= 1.25 },
        { label: 'Cash Flow',            value: `${fmt.currency(multiFamily.cashFlow)}/mo`,          highlight: multiFamily.cashFlow > 0 },
        { label: 'Cash-on-Cash',         value: `${(multiFamily.cashOnCash * 100).toFixed(1)}%` },
        { label: 'Total Cash In',        value: fmt.currency(multiFamily.totalCashIn) },
        { label: 'Expense Ratio',        value: `${(multiFamily.expenseRatio * 100).toFixed(0)}%` },
        { label: 'Break-Even Occ.',      value: `${(multiFamily.breakEvenOccupancy * 100).toFixed(0)}%` },
        { label: 'Income Valuation',     value: fmt.currency(multiFamily.valuationByCapRate) },
        { label: 'Per-Unit Value',       value: fmt.currency(multiFamily.perUnitValue) },
      ],
    },

    airbnb: {
      score:    a?.dealScore ?? 0,
      eligible: a?.eligible ?? false,
      lines: a ? [
        // ── DSCR Loan Terms ──────────────────────────────────────────────────
        { label: '── DSCR Loan ──',        value: '' },
        { label: 'Loan Amount (75% LTV)',  value: fmt.currency(a.dscrLoanAmount ?? 0) },
        { label: 'Down Payment (25%)',     value: fmt.currency(a.dscrDownPayment ?? 0),          highlight: true },
        { label: 'DSCR Rate',             value: `${((a.dscrRate ?? 0) * 100).toFixed(2)}%` },
        { label: 'Monthly P&I',           value: `${fmt.currency(a.dscrMonthlyPayment ?? 0)}/mo` },
        { label: 'Monthly PITIA',         value: `${fmt.currency(a.dscrMonthlyPITIA ?? 0)}/mo` },
        // ── LTR Analysis ─────────────────────────────────────────────────────
        { label: '── Long-Term Rental ──', value: '' },
        { label: 'Market Rent',           value: `${fmt.currency(a.ltrMonthlyRent ?? 0)}/mo` },
        { label: 'LTR DSCR',             value: `${(a.ltrDSCR ?? 0).toFixed(2)}x`,             highlight: a.ltrQualifies },
        { label: 'DSCR Qualifies',        value: a.ltrQualifies ? '✓ Yes (≥1.0)' : '✗ No (<1.0)', highlight: a.ltrQualifies },
        { label: 'LTR Cash Flow',         value: `${fmt.currency(a.ltrMonthlyCashFlow ?? 0)}/mo`, highlight: (a.ltrMonthlyCashFlow ?? 0) > 0 },
        { label: 'LTR Cash-on-Cash',      value: `${((a.ltrCashOnCash ?? 0) * 100).toFixed(1)}%`, highlight: (a.ltrCashOnCash ?? 0) > 0.08 },
        // ── STR (Airbnb) Analysis ─────────────────────────────────────────────
        { label: '── Airbnb / STR ──',    value: '' },
        { label: 'Gross STR Revenue',     value: `${fmt.currency(a.monthlyRevenue)}/mo`,         highlight: true },
        { label: 'Annual STR Revenue',    value: fmt.currency(a.annualRevenue) },
        { label: 'Market ADR',            value: result.airbnbMarket ? `$${result.airbnbMarket.medianNightlyRate}/night · ${result.airbnbMarket.sampleCount} active` : `$${(a.revenuePerNight ?? 0).toFixed(0)}/night (est.)` },
        { label: 'ADR Range',             value: result.airbnbMarket ? `$${result.airbnbMarket.priceRange.low}–$${result.airbnbMarket.priceRange.high}/night` : '—' },
        { label: 'STR DSCR (75% haircut)',value: `${(a.strDSCR ?? 0).toFixed(2)}x`,             highlight: a.strQualifies },
        { label: 'STR Net Income',        value: `${fmt.currency(a.monthlyNetIncome)}/mo`,       highlight: a.monthlyNetIncome > 0 },
        { label: 'STR Cash-on-Cash',      value: `${(a.cashOnCash * 100).toFixed(1)}%`,          highlight: a.cashOnCash > 0.08 },
        { label: 'STR vs LTR',            value: `${(a.vsLongTermRental ?? 0) >= 0 ? '+' : ''}${fmt.currency(a.vsLongTermRental ?? 0)}/yr`, highlight: (a.vsLongTermRental ?? 0) > 0 },
        { label: 'Furnishing Cost',       value: fmt.currency(a.furnishingCost) },
        { label: 'Furnishing Payback',    value: a.paybackMonths > 0 ? `${Math.round(a.paybackMonths)} mo` : '—' },
      ] : [],
    },

    'buy-hold': {
      score:    coreMetrics ? Math.round(
        (coreMetrics.dscr >= 1.25 ? 35 : coreMetrics.dscr >= 1.0 ? 20 : 0) +
        (coreMetrics.cashOnCashReturn >= 0.12 ? 30 : coreMetrics.cashOnCashReturn >= 0.08 ? 20 : coreMetrics.cashOnCashReturn >= 0.05 ? 10 : 0) +
        (coreMetrics.capRate >= 0.08 ? 20 : coreMetrics.capRate >= 0.06 ? 12 : coreMetrics.capRate >= 0.04 ? 5 : 0) +
        (coreMetrics.monthlyCashFlow >= 300 ? 15 : coreMetrics.monthlyCashFlow >= 0 ? 8 : 0)
      ) : 0,
      eligible: true,
      lines: coreMetrics ? [
        { label: 'Market Rent',           value: `${fmt.currency(coreMetrics.grossRentAnnual / 12)}/mo` },
        { label: 'NOI',                   value: `${fmt.currency(coreMetrics.noi)}/yr`,          highlight: true },
        { label: 'Cap Rate',              value: `${(coreMetrics.capRate * 100).toFixed(2)}%`,    highlight: coreMetrics.capRate >= 0.06 },
        { label: 'GRM',                   value: `${coreMetrics.grm.toFixed(1)}x` },
        { label: 'DSCR',                  value: `${coreMetrics.dscr.toFixed(2)}x`,              highlight: coreMetrics.dscr >= 1.25 },
        { label: 'Annual Debt Service',   value: `${fmt.currency(coreMetrics.annualDebtService)}/yr` },
        { label: 'Monthly Cash Flow',     value: `${fmt.currency(coreMetrics.monthlyCashFlow)}/mo`, highlight: coreMetrics.monthlyCashFlow > 0 },
        { label: 'Annual Cash Flow',      value: `${fmt.currency(coreMetrics.annualCashFlow)}/yr` },
        { label: 'Cash-on-Cash',          value: `${(coreMetrics.cashOnCashReturn * 100).toFixed(1)}%`, highlight: coreMetrics.cashOnCashReturn > 0.08 },
        { label: 'Operating Expenses',    value: `${fmt.currency(coreMetrics.operatingExpenses)}/yr` },
        { label: 'Equity @ Purchase',     value: fmt.currency(coreMetrics.equityAtPurchase) },
        { label: 'Equity @ 5yr',          value: fmt.currency(coreMetrics.equityAt5yr),          highlight: true },
        { label: 'Appreciation @ 5yr',    value: fmt.currency(coreMetrics.appreciationAt5yr) },
        { label: '5-yr Total Return',     value: fmt.currency(coreMetrics.totalProjectedReturn5yr), highlight: true },
      ] : [],
    },

    brrrr: {
      score:   b?.dealScore ?? 0,
      eligible: b?.eligible ?? false,
      lines: b ? [
        { label: 'Total Cash In',       value: fmt.currency(b.totalCashIn),           highlight: true },
        { label: 'Refi Loan (75% ARV)', value: fmt.currency(b.refiLoanAmount) },
        { label: 'Cash Returned',       value: fmt.currency(b.cashReturned),          highlight: true },
        { label: 'Cash Left in Deal',   value: fmt.currency(b.cashLeftInDeal),        highlight: b.cashLeftInDeal < b.totalCashIn * 0.2 },
        { label: 'Refi Coverage',       value: `${(b.refiCoverage * 100).toFixed(0)}%` },
        { label: 'Refi Payment',        value: `${fmt.currency(b.refiMonthlyPayment)}/mo` },
        { label: 'Market Rent',         value: `${fmt.currency(b.marketRent)}/mo` },
        { label: 'Monthly OpEx',        value: `${fmt.currency(b.totalOpex)}/mo` },
        { label: 'Monthly Cash Flow',   value: `${fmt.currency(b.monthlyCashFlow)}/mo`, highlight: b.monthlyCashFlow > 0 },
        { label: 'Cash-on-Cash',        value: b.cashOnCash >= 9.99 ? '∞' : `${(b.cashOnCash * 100).toFixed(1)}%`, highlight: b.cashOnCash > 0.15 },
        { label: 'Equity Capture',      value: fmt.currency(b.equityCapture),         highlight: b.equityCapture > 30_000 },
      ] : [],
    },

    'private-money': {
      score:   privateMoney?.dealScore ?? 0,
      eligible: privateMoney?.eligible ?? false,
      lines: privateMoney ? [
        { label: 'Max Loan (ARV 70%)',    value: fmt.currency(privateMoney.loanAmountByARV) },
        { label: 'Max Loan (LTC 90%)',    value: fmt.currency(privateMoney.loanAmountByLTC) },
        { label: 'Loan Amount Used',      value: fmt.currency(privateMoney.maxLoan),             highlight: true },
        { label: 'Rate',                  value: `${(privateMoney.rate * 100).toFixed(1)}%` },
        { label: 'Points',               value: `${privateMoney.points}%` },
        { label: 'Points Cost',           value: fmt.currency(privateMoney.pointsCost),           highlight: true },
        { label: 'Monthly Interest',      value: `${fmt.currency(privateMoney.monthlyInterest)}/mo` },
        { label: 'Hold Period',           value: `${privateMoney.holdingPeriodMonths} months` },
        { label: 'Total Interest',        value: fmt.currency(privateMoney.totalInterest) },
        { label: 'Total Cost of Capital', value: fmt.currency(privateMoney.totalCostOfCapital),   highlight: true },
        { label: 'Cash to Close',         value: fmt.currency(privateMoney.cashRequiredToClose),  highlight: privateMoney.cashRequiredToClose < privateMoney.maxLoan * 0.15 },
        { label: 'All-In Cost',           value: fmt.currency(privateMoney.allInCost) },
        { label: 'Cost of Capital %',     value: `${(privateMoney.annualizedCostPct * 100).toFixed(1)}%/yr` },
      ] : [],
    },

    'cash-offer': {
      score:    wholesale.dealScore,
      eligible: wholesale.eligible,
      lines: [
        { label: 'Max Allowable Offer',   value: fmt.currency(wholesale.mao),              highlight: true },
        { label: 'Suggested Offer',       value: fmt.currency(wholesale.suggestedOfferPrice) },
        { label: 'Consensus ARV',         value: fmt.currency(result.arv.adjustedARV) },
        { label: 'Repair Budget',         value: fmt.currency(result.input.estimatedRepairs) },
        { label: 'Assignment Fee',        value: wholesale.wholesaleFee > 0 ? fmt.currency(wholesale.wholesaleFee) : '—', highlight: wholesale.wholesaleFee > 0 },
        { label: 'End Buyer Price',       value: fmt.currency(wholesale.endBuyerPrice) },
        { label: 'End Buyer Equity',      value: fmt.currency(wholesale.endBuyerEquity),    highlight: wholesale.endBuyerEquity > 30_000 },
        { label: 'End Buyer ROI',         value: `${(wholesale.endBuyerROI * 100).toFixed(0)}%` },
        { label: 'Spread to Buyer',       value: fmt.currency(wholesale.spreadToBuyer) },
        { label: 'Earnest Money (EMD)',   value: fmt.currency(wholesale.estimatedEMD) },
        { label: 'ROI on EMD',            value: `${wholesale.roiOnEMD.toFixed(1)}x`,      highlight: wholesale.roiOnEMD > 5 },
      ],
    },

    'listing': (() => {
      const arvVal    = result.arv.adjustedARV
      const offerPrice = result.input.askingPrice > 0 ? result.input.askingPrice : result.coreMetrics.mao
      const listPrice  = Math.round(arvVal * 0.97)
      const commission = Math.round(listPrice * 0.055)
      const closingCosts = Math.round(listPrice * 0.01)
      const netToSeller  = listPrice - commission - closingCosts
      const gap          = netToSeller - offerPrice
      const score        = gap <= 0 ? 88 : gap <= 15_000 ? 68 : gap <= 35_000 ? 45 : gap <= 60_000 ? 25 : 12
      return {
        score,
        eligible: true,
        lines: [
          { label: 'Suggested List Price',    value: fmt.currency(listPrice) },
          { label: 'Agent Commission (5.5%)', value: `(${fmt.currency(commission)})` },
          { label: 'Seller Closing Costs',    value: `(${fmt.currency(closingCosts)})` },
          { label: 'Net to Seller (Listing)', value: fmt.currency(netToSeller),         highlight: true },
          { label: 'Your Offer',              value: fmt.currency(offerPrice) },
          { label: 'Gap vs Cash Offer',       value: gap >= 0 ? `+${fmt.currency(gap)} listing wins` : `${fmt.currency(Math.abs(gap))} cash wins`, highlight: gap < 0 },
          { label: 'Avg DOM',                 value: result.marketData?.demandScore ? `${Math.round(result.marketData.demandScore)}d` : '—' },
          { label: 'Offer Competitiveness',   value: gap <= 0 ? '✓ Cash offer wins' : gap <= 15_000 ? '≈ Near listing net' : '✗ Listing nets more' },
        ],
      }
    })(),
  }

  const data = dataMap[strategy]
  if (!data) return null

  return (
    <div className={`strategy-card ${rank === 1 ? 'active' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{ICONS[strategy]}</span>
          <div>
            <p className="text-sm font-semibold text-white">{STRATEGY_LABELS[strategy]}</p>
            <p className="text-xs text-slate-500">#{rank} ranked</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-extrabold ${data.score >= 70 ? 'text-cyan-400' : data.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.score}
          </p>
          <p className="text-xs text-slate-500">/ 100</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="w-full bg-slate-700 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full transition-all ${SCORE_BAR_COLOR(data.score)}`}
          style={{ width: `${data.score}%` }}
        />
      </div>

      <div className={`text-xs font-medium mb-3 ${data.eligible ? 'text-emerald-400' : 'text-slate-500'}`}>
        {data.eligible ? '✓ Eligible' : '✗ Not Eligible'}
      </div>

      {/* Stats grid */}
      {data.lines.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
          {data.lines.map((line, i) =>
            line.value === '' ? (
              // Section header — spans full width
              <div key={i} className="col-span-2 pt-1.5 pb-0.5 border-t border-slate-700/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{line.label.replace(/^── |── $/g, '')}</span>
              </div>
            ) : (
              <div key={i} className="flex justify-between items-baseline gap-1 min-w-0">
                <span className="text-xs text-slate-500 truncate shrink-0">{line.label}</span>
                <span className={`text-xs font-semibold tabular-nums text-right ${line.highlight ? 'text-cyan-300' : 'text-slate-200'}`}>
                  {line.value}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {/* AI rationale */}
      {aiRank && (
        <div className="mt-3 pt-3 border-t border-slate-700/60">
          <p className="text-xs text-slate-400 italic leading-relaxed">{aiRank.rationale}</p>
        </div>
      )}
    </div>
  )
}
