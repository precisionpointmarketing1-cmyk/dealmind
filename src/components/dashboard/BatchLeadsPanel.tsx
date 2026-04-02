'use client'

import { BatchLeadsPropertyData } from '@/lib/api-clients/batchleads'
import { fmt } from '@/lib/utils/formatters'

interface Props {
  data: BatchLeadsPropertyData
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-cyan-400' : 'text-white'}`}>{value}</span>
    </div>
  )
}

export default function BatchLeadsPanel({ data }: Props) {
  const m = data.mortgage

  const hasLienRisk = (data.totalOpenLiens ?? 0) > 0
  const ltvColor = !data.ltv ? 'text-slate-400'
    : data.ltv < 50 ? 'text-emerald-400'
    : data.ltv < 80 ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Mortgage &amp; Lien Intel</h3>
          <p className="text-xs text-slate-500 mt-0.5">Via BatchLeads · {data.address ?? 'matched property'}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
          Found in BatchLeads
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* AVM / Value */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/40">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Valuation</p>
          <Row label="Estimated Value (AVM)" value={data.estimatedValue ? fmt.currency(data.estimatedValue) : '—'} highlight />
          <Row label="Last Sale Price"        value={data.lastSalePrice  ? fmt.currency(data.lastSalePrice)  : '—'} />
          <Row label="Last Sale Date"         value={data.lastSaleDate   ? new Date(data.lastSaleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
          <Row label="Equity"                 value={data.equity         ? fmt.currency(data.equity)         : '—'} highlight={!!data.equity && data.equity > 0} />
          <Row label="LTV"                    value={data.ltv != null    ? `${data.ltv.toFixed(1)}%`         : '—'} />
        </div>

        {/* Mortgage */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/40">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Existing Mortgage</p>
          {m ? (
            <>
              <Row label="Lender"           value={m.lenderName               ?? '—'} />
              <Row label="Loan Type"        value={m.loanType                 ?? '—'} />
              <Row label="Original Amount"  value={m.loanAmount               ? fmt.currency(m.loanAmount)               : '—'} />
              <Row label="Current Balance"  value={m.currentEstimatedBalance  ? fmt.currency(m.currentEstimatedBalance)  : '—'} highlight />
              <Row label="Interest Rate"    value={m.currentEstimatedInterestRate != null ? `${m.currentEstimatedInterestRate.toFixed(2)}%` : '—'} />
              <Row label="Est. Payment/mo"  value={m.estimatedPaymentAmount   ? fmt.currency(m.estimatedPaymentAmount)   : '—'} highlight />
            </>
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">No mortgage on record — may be free &amp; clear</p>
          )}
        </div>

        {/* Liens */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/40">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Liens &amp; Encumbrances</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
              <span className="text-xs text-slate-400">Total Open Liens</span>
              <span className={`text-sm font-bold ${hasLienRisk ? 'text-red-400' : 'text-emerald-400'}`}>
                {data.totalOpenLiens ? fmt.currency(data.totalOpenLiens) : '$0'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
              <span className="text-xs text-slate-400">LTV (Combined)</span>
              <span className={`text-sm font-bold ${ltvColor}`}>
                {data.ltv != null ? `${data.ltv.toFixed(1)}%` : '—'}
              </span>
            </div>
            {hasLienRisk && (
              <div className="mt-2 bg-red-500/10 border border-red-500/25 rounded-lg p-3">
                <p className="text-xs text-red-400 font-medium">⚠ Liens Detected</p>
                <p className="text-xs text-red-400/70 mt-1">
                  {fmt.currency(data.totalOpenLiens!)} in open liens — title search required before close.
                </p>
              </div>
            )}
            {!hasLienRisk && !m && (
              <div className="mt-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-3">
                <p className="text-xs text-emerald-400 font-medium">✓ Free &amp; Clear</p>
                <p className="text-xs text-emerald-400/70 mt-1">No open liens or mortgage on record.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
