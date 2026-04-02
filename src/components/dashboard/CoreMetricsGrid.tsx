import { CoreMetrics } from '@/types/deal'
import { fmt } from '@/lib/utils/formatters'
import { DEFAULTS } from '@/lib/utils/constants'

interface Props {
  metrics: CoreMetrics
  marketRent?: number
}

export default function CoreMetricsGrid({ metrics, marketRent }: Props) {
  const m = metrics

  const metricRows = [
    { label: 'Cap Rate',          value: fmt.pct(m.capRate),                    good: m.capRate >= DEFAULTS.MIN_CAP_RATE,     sub: null },
    { label: 'Cash-on-Cash',      value: fmt.pct(m.cashOnCashReturn),           good: m.cashOnCashReturn >= DEFAULTS.MIN_COC, sub: null },
    { label: 'DSCR',              value: m.dscr.toFixed(2) + 'x',              good: m.dscr >= DEFAULTS.MIN_DSCR,            sub: null },
    { label: 'GRM',               value: m.grm.toFixed(1) + 'x',              good: m.grm < 12,                             sub: null },
    { label: 'NOI (Annual)',       value: fmt.currency(m.noi),                  good: m.noi > 0,                              sub: null },
    { label: 'Monthly Cash Flow', value: fmt.currency(m.monthlyCashFlow),       good: m.monthlyCashFlow > 0,                  sub: null },
    { label: 'Annual Cash Flow',  value: fmt.currency(m.annualCashFlow),        good: m.annualCashFlow > 0,                   sub: null },
    { label: 'Debt Service/mo',   value: fmt.currency(m.monthlyDebtService),    good: true, sub: `${fmt.currency(m.annualDebtService)}/yr` },
    { label: 'Loan Amount',       value: fmt.currency(m.loanAmount),            good: true, sub: `on ${fmt.currency(m.purchasePrice)} purchase` },
    { label: 'Market Rent',       value: marketRent ? fmt.currency(marketRent) + '/mo' : 'N/A', good: true, sub: null },
    { label: '5-yr Appreciation', value: fmt.currency(m.appreciationAt5yr),     good: m.appreciationAt5yr > 0,               sub: null },
    { label: '5-yr Equity',       value: fmt.currency(m.equityAt5yr),           good: m.equityAt5yr > 0,                     sub: null },
    { label: '5-yr Total Return', value: fmt.currency(m.totalProjectedReturn5yr), good: m.totalProjectedReturn5yr > 0,        sub: null },
  ]

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-3">Core Investment Metrics</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {metricRows.map(row => (
          <div key={row.label} className="metric-card">
            <span className="metric-label">{row.label}</span>
            <span className={`text-xl font-bold ${row.good ? 'text-white' : 'text-red-400'}`}>{row.value}</span>
            {row.sub && <span className="text-xs text-slate-500 mt-0.5">{row.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
