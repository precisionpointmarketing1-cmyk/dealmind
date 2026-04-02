'use client'

import { useState, useMemo } from 'react'
import { AnalysisResult, ExitStrategy } from '@/types/deal'
import { fmt } from '@/lib/utils/formatters'
import { STRATEGY_LABELS } from '@/lib/utils/constants'
import StrategyPanel from '@/components/strategies/StrategyPanel'
import MarketGradeCard from '@/components/dashboard/MarketGradeCard'
import CoreMetricsGrid from '@/components/dashboard/CoreMetricsGrid'
import SaleCompsPanel from '@/components/dashboard/SaleCompsPanel'
import ARVComparisonPanel from '@/components/dashboard/ARVComparisonPanel'
import NeighborhoodPanel from '@/components/dashboard/NeighborhoodPanel'
import BatchLeadsPanel from '@/components/dashboard/BatchLeadsPanel'
import RepairDetailsPanel from '@/components/dashboard/RepairDetailsPanel'
import RehabPanel from '@/components/dashboard/RehabPanel'

interface Props {
  result: AnalysisResult
  sessionPhotos?: string[]
  onReset: () => void
}

const SCORE_COLOR = (s: number) => s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-yellow-400' : 'text-red-400'

export default function AnalysisDashboard({ result, sessionPhotos, onReset }: Props) {
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [generatingSeller, setGeneratingSeller] = useState(false)
  const [generatingAcq, setGeneratingAcq] = useState(false)
  const [selectedComps, setSelectedComps] = useState<import('@/types/deal').SaleComp[]>([])
  const [selectedARV, setSelectedARV] = useState<number>(0)
  const [ourOffer, setOurOffer] = useState<number>(0)       // 0 = use MAO
  const [editingOffer, setEditingOffer] = useState(false)
  const [activeRepairs, setActiveRepairs] = useState<number>(0)  // 0 = use input.estimatedRepairs
  const [addedRepairItems, setAddedRepairItems] = useState<{ description: string; cost: number }[]>([])
  const { input, coreMetrics, wholesale, subjectTo, airbnb, brrrr, arv, aiAnalysis, rentComps, saleComps } = result

  // Merge ATTOM sold comps into the primary comps array so they appear in the sold tab.
  // ATTOM returns real closed transactions from /sale/snapshot — these are the most reliable ARV comps.
  // RentCast comps (active/pending/AVM) are added after, deduped by address.
  const mergedComps = useMemo(() => {
    const seen = new Set<string>()
    const out: import('@/types/deal').SaleComp[] = []
    // Priority: Repliers (MLS) first — most accurate, has photos
    for (const c of result.repliersSaleComps ?? []) {
      const key = c.address.toLowerCase().trim()
      if (key && !seen.has(key)) { seen.add(key); out.push(c) }
    }
    // Then ATTOM
    for (const c of result.attomSaleComps ?? []) {
      const key = c.address.toLowerCase().trim()
      if (key && !seen.has(key)) { seen.add(key); out.push(c) }
    }
    // Then RentCast AVM
    for (const c of saleComps?.comparables ?? []) {
      const key = c.address.toLowerCase().trim()
      if (key && !seen.has(key)) { seen.add(key); out.push(c) }
    }
    return out
  }, [result.repliersSaleComps, result.attomSaleComps, saleComps?.comparables])

  async function downloadAcquisitionsReport() {
    setGeneratingAcq(true)
    try {
      const res = await fetch('/api/acquisitions-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, selectedComps, selectedARV: selectedARV > 0 ? selectedARV : undefined, activeRepairs: activeRepairs > 0 ? activeRepairs : undefined, addedRepairItems: addedRepairItems.length > 0 ? addedRepairItems : undefined, sessionPhotos }),
      })
      if (!res.ok) throw new Error('Acquisitions report generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `AcquisitionsReport-${input.address.replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingAcq(false)
    }
  }

  async function downloadSellerReport() {
    setGeneratingSeller(true)
    try {
      const res = await fetch('/api/seller-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, selectedComps, selectedARV: selectedARV > 0 ? selectedARV : undefined, ourOffer: ourOffer > 0 ? ourOffer : undefined, activeRepairs: activeRepairs > 0 ? activeRepairs : undefined, addedRepairItems: addedRepairItems.length > 0 ? addedRepairItems : undefined, sessionPhotos: sessionPhotos?.length ? sessionPhotos : result.propertyPhotos }),
      })
      if (!res.ok) throw new Error('Seller report generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SellerReport-${input.address.replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingSeller(false)
    }
  }

  async function downloadReport() {
    setGeneratingPDF(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, photos: sessionPhotos ?? result.propertyPhotos ?? [], selectedComps, activeRepairs: activeRepairs > 0 ? activeRepairs : undefined, addedRepairItems: addedRepairItems.length > 0 ? addedRepairItems : undefined }),
      })
      if (!res.ok) throw new Error('Report generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `DealReport-${input.address.replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingPDF(false)
    }
  }

  const buyHoldScore = coreMetrics ? Math.round(
    (coreMetrics.dscr >= 1.25 ? 35 : coreMetrics.dscr >= 1.0 ? 20 : 0) +
    (coreMetrics.cashOnCashReturn >= 0.12 ? 30 : coreMetrics.cashOnCashReturn >= 0.08 ? 20 : coreMetrics.cashOnCashReturn >= 0.05 ? 10 : 0) +
    (coreMetrics.capRate >= 0.08 ? 20 : coreMetrics.capRate >= 0.06 ? 12 : coreMetrics.capRate >= 0.04 ? 5 : 0) +
    (coreMetrics.monthlyCashFlow >= 300 ? 15 : coreMetrics.monthlyCashFlow >= 0 ? 8 : 0)
  ) : 0

  const arv_           = arv.adjustedARV
  const repairs        = activeRepairs > 0 ? activeRepairs : input.estimatedRepairs
  const marketRent     = rentComps?.rentAvg ?? 0
  // When user selects comps or changes rehab, recalculate LAO + MAO live
  const displayARV     = selectedARV > 0 ? selectedARV : arv_
  const lao            = (selectedARV > 0 || activeRepairs > 0)
    ? Math.max(0, Math.round(displayARV * 0.60 - repairs))
    : coreMetrics.lao
  const mao            = (selectedARV > 0 || activeRepairs > 0)
    ? Math.max(0, Math.round(displayARV * 0.70 - repairs))
    : coreMetrics.mao
  const contractPrice  = input.askingPrice > 0 ? input.askingPrice : mao
  const assignmentFee  = (input.assignmentFee && input.assignmentFee > 0) ? input.assignmentFee : 0
  const assignmentPrice = contractPrice + assignmentFee
  const hasAssignment  = assignmentFee > 0
  const hasSeller      = input.askingPrice > 0 && input.askingPrice !== mao
  const belowLAO       = hasSeller && input.askingPrice <= lao
  const belowMAO       = hasSeller && input.askingPrice < mao
  const maoVsAsking    = hasSeller ? mao - input.askingPrice : 0
  const laoVsAsking    = hasSeller ? lao - input.askingPrice : 0

  // Listing score — how competitive is a cash offer vs MLS listing
  const listPrice_      = Math.round(arv_ * 0.97)
  const listCommission_ = Math.round(listPrice_ * 0.055)
  const listClose_      = Math.round(listPrice_ * 0.01)
  const listNet_        = listPrice_ - listCommission_ - listClose_
  const listGap_        = listNet_ - (input.askingPrice > 0 ? input.askingPrice : mao)
  const listingScore    = listGap_ <= 0 ? 88 : listGap_ <= 15_000 ? 68 : listGap_ <= 35_000 ? 45 : listGap_ <= 60_000 ? 25 : 12

  const acquisitionStrategies = ([
    { key: 'cash-offer' as ExitStrategy,  score: wholesale.dealScore,   label: STRATEGY_LABELS['cash-offer'] },
    { key: 'subject-to' as ExitStrategy,  score: subjectTo.dealScore,   label: STRATEGY_LABELS['subject-to'] },
    { key: 'listing' as ExitStrategy,     score: listingScore,          label: STRATEGY_LABELS['listing'] },
  ]).sort((a, b) => b.score - a.score)

  const topStrategy = acquisitionStrategies[0]

  return (
    <div className="space-y-6">

      {/* ── Hero: LAO + MAO ── */}
      <div className="card overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border-orange-500/30">
        {sessionPhotos && sessionPhotos.length > 0 && (
          <div className="w-full h-48 overflow-hidden">
            <img src={sessionPhotos[0]} alt="Property" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
        <p className="text-sm text-slate-400 mb-3">
          {input.address}, {input.city}, {input.state} {input.zip}
          {' · '}{input.bedrooms}bd / {input.bathrooms}ba · {input.sqft?.toLocaleString()} sqft · {input.yearBuilt}
        </p>

        {/* LAO (primary) + MAO (ceiling) side by side */}
        <div className="flex flex-col md:flex-row gap-3 md:items-stretch mb-4">
          {/* LAO — acquisitions focus */}
          <div className="rounded-2xl px-8 py-5 text-center flex-1 glow-cyan"
            style={{ background: 'linear-gradient(135deg, rgba(0,200,255,0.15) 0%, rgba(0,102,204,0.15) 100%)', border: '1px solid rgba(0,200,255,0.4)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1 gradient-text">Lowest Allowable Offer</p>
            <p className="text-5xl font-extrabold text-white">{fmt.currency(lao)}</p>
            <p className="text-xs text-cyan-400 font-semibold mt-2">Start here — acquisition target</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {fmt.currency(displayARV)} × 60% − {fmt.currency(repairs)}
            </p>
          </div>
          {/* MAO — ceiling */}
          <div className="rounded-2xl px-6 py-5 text-center flex-1"
            style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-orange-400">Max Allowable Offer</p>
            <p className="text-4xl font-extrabold text-white">{fmt.currency(mao)}</p>
            <p className="text-xs text-orange-400/70 font-semibold mt-2">Ceiling — never go above this</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {(selectedARV > 0 || activeRepairs > 0) ? '↳ Updated from your inputs' : 'ARV × 70% − Repairs'}
            </p>
          </div>
          {/* Negotiation spread */}
          {lao > 0 && mao > lao && (
            <div className="rounded-2xl px-6 py-5 text-center"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-emerald-400">Negotiation Room</p>
              <p className="text-4xl font-extrabold text-emerald-400">{fmt.currency(mao - lao)}</p>
              <p className="text-xs text-emerald-400/70 font-semibold mt-2">LAO → MAO spread</p>
              <p className="text-xs text-slate-500 mt-0.5">Every dollar below MAO = extra profit</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
            {/* ARV + Rent row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className={`rounded-xl p-3 transition-all ${selectedARV > 0 ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-slate-900/60'}`}>
                <p className="text-xs text-slate-500 mb-0.5">{selectedARV > 0 ? 'Comps-Adjusted ARV' : 'Consensus ARV'}</p>
                <p className="text-xl font-bold text-white">{fmt.currency(selectedARV > 0 ? selectedARV : arv_)}</p>
                <p className="text-xs text-slate-500">
                  {selectedARV > 0
                    ? `from ${selectedComps.filter(c => c.status === 'sold').length} selected sold comps`
                    : `${arv.compsUsed} comps · ${arv.confidence} confidence`}
                </p>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Market Rent</p>
                <p className="text-xl font-bold text-white">{marketRent > 0 ? fmt.currency(marketRent) + '/mo' : '—'}</p>
                <p className="text-xs text-slate-500">RentCast estimate</p>
              </div>
              <div className={`rounded-xl p-3 transition-all ${activeRepairs > 0 ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-slate-900/60'}`}>
                <p className="text-xs text-slate-500 mb-0.5">Repair Budget</p>
                <p className="text-xl font-bold text-white">{fmt.currency(repairs)}</p>
                <p className="text-xs text-slate-500">{activeRepairs > 0 ? '↳ Updated from rehab panel' : 'as entered'}</p>
              </div>
            </div>

            {/* Seller asking price comparison (only if provided) */}
            {hasSeller && (
              <div className={`rounded-xl px-4 py-3 flex items-center justify-between border ${
                belowLAO  ? 'bg-emerald-500/10 border-emerald-500/30'
                : belowMAO ? 'bg-yellow-500/10 border-yellow-500/30'
                :            'bg-red-500/10 border-red-500/30'
              }`}>
                <div>
                  <p className="text-xs font-semibold text-slate-400">Seller Asking Price</p>
                  <p className="text-lg font-bold text-white">{fmt.currency(input.askingPrice)}</p>
                </div>
                <div className="text-right">
                  {belowLAO ? (
                    <>
                      <p className="text-xs text-emerald-400 font-semibold">✓ At / Below LAO</p>
                      <p className="text-lg font-bold text-emerald-400">+{fmt.currency(Math.abs(laoVsAsking))} under LAO</p>
                    </>
                  ) : belowMAO ? (
                    <>
                      <p className="text-xs text-yellow-400 font-semibold">⚠ Between LAO and MAO</p>
                      <p className="text-lg font-bold text-yellow-400">{fmt.currency(maoVsAsking)} under MAO</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-red-400 font-semibold">✗ Over MAO</p>
                      <p className="text-lg font-bold text-red-400">{fmt.currency(Math.abs(maoVsAsking))} over MAO</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Assignment price (when fee is entered) */}
            {hasAssignment && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between border bg-cyan-500/10 border-cyan-500/30">
                <div>
                  <p className="text-xs font-semibold text-slate-400">Investor Purchase Price</p>
                  <p className="text-lg font-bold text-white">{fmt.currency(assignmentPrice)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{fmt.currency(contractPrice)} contract + {fmt.currency(assignmentFee)} your fee</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-cyan-400 font-semibold">Your Profit</p>
                  <p className="text-lg font-bold text-cyan-400">{fmt.currency(assignmentFee)}</p>
                </div>
              </div>
            )}

            {/* AI recommended strategy */}
            <div className="bg-slate-900/60 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">AI Recommended Strategy</p>
                <p className="text-base font-bold gradient-text">{STRATEGY_LABELS[topStrategy.key]}</p>
              </div>
              <p className={`text-2xl font-extrabold ${SCORE_COLOR(topStrategy.score)}`}>{topStrategy.score}/100</p>
            </div>
        </div>
        </div>

      </div>

      {/* ── ARV Comparison ── */}
      <ARVComparisonPanel arv={arv} userEstimate={result.input.estimatedARV} selectedCompsARV={selectedARV > 0 ? selectedARV : undefined} />

      {/* ── Core Metrics ── */}
      <CoreMetricsGrid metrics={coreMetrics} marketRent={marketRent} />

      {/* ── Rehab Budget ── */}
      <RehabPanel
        rehabScan={result.rehabScan}
        baseRepairs={input.estimatedRepairs}
        addedItems={addedRepairItems}
        onRepairsChange={setActiveRepairs}
        onItemsChange={setAddedRepairItems}
      />

      {/* ── BatchLeads: Mortgage / Lien / Equity ── */}
      {result.batchLeadsData && (
        <BatchLeadsPanel data={result.batchLeadsData} />
      )}

      {/* ── Known Issues / Repair Details ── */}
      <RepairDetailsPanel
        knownIssues={input.knownIssues}
        repairNotes={input.repairNotes}
        totalRepairs={repairs}
      />

      {/* ── Sale Comps ── */}
      {mergedComps.length > 0 && (
        <SaleCompsPanel
          comps={mergedComps}
          attomComps={result.attomSaleComps}
          subjectSqft={input.sqft ?? 0}
          repairs={repairs}
          subjectAddress={`${input.address}, ${input.city}, ${input.state}`}
          subjectLat={input.lat}
          subjectLng={input.lng}
          subjectYearBuilt={input.yearBuilt}
          onCompsSelected={setSelectedComps}
          onARVChange={setSelectedARV}
        />
      )}

      {/* ── Acquisition Strategy ── */}
      <div>
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-white">Acquisition Strategy</h3>
          <p className="text-xs text-slate-500 mt-0.5">Best way to structure and close this deal</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {acquisitionStrategies.map((s, i) => (
            <StrategyPanel
              key={s.key}
              strategy={s.key}
              rank={i + 1}
              result={result}
              aiRank={aiAnalysis?.strategyRankings?.find(r => r.strategy === s.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Deal Structure Cross-Check ── */}
      <div className="card p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Deal Structure Cross-Check</h3>
          <p className="text-xs text-slate-500 mt-0.5">How your cash offer stacks up across every entry + exit combination</p>
        </div>

        {/* Ask price vs LAO / MAO signal */}
        <div className={`rounded-xl px-4 py-3 mb-4 flex items-center justify-between border ${
          input.askingPrice <= lao  ? 'bg-emerald-500/10 border-emerald-500/30'
          : input.askingPrice <= mao ? 'bg-yellow-500/10 border-yellow-500/30'
          :                            'bg-red-500/10 border-red-500/30'
        }`}>
          <div>
            <p className="text-xs font-semibold text-slate-400">Ask vs Offer Range</p>
            <p className="text-base font-bold text-white">
              {fmt.currency(input.askingPrice)} asked · LAO {fmt.currency(lao)} · MAO {fmt.currency(mao)}
            </p>
          </div>
          <div className="text-right">
            {input.askingPrice <= lao ? (
              <>
                <p className="text-xs text-emerald-400 font-semibold">✓ At or below LAO — strong deal</p>
                <p className="text-lg font-bold text-emerald-400">+{fmt.currency(lao - input.askingPrice)} under LAO</p>
              </>
            ) : input.askingPrice <= mao ? (
              <>
                <p className="text-xs text-yellow-400 font-semibold">⚠ Between LAO and MAO — negotiate down</p>
                <p className="text-lg font-bold text-yellow-400">{fmt.currency(mao - input.askingPrice)} under MAO ceiling</p>
              </>
            ) : (
              <>
                <p className="text-xs text-red-400 font-semibold">✗ Over MAO — needs creative structure</p>
                <p className="text-lg font-bold text-red-400">{fmt.currency(input.askingPrice - mao)} over MAO</p>
              </>
            )}
          </div>
        </div>

        {/* Strategy matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { entry: 'Cash Offer', exit: 'Assign / Wholesale',   eligible: wholesale.eligible, score: wholesale.dealScore, note: `MAO ${fmt.currency(mao)} · ${fmt.currency(wholesale.wholesaleFee)} fee · ${wholesale.roiOnEMD.toFixed(1)}x ROI on EMD` },
            { entry: 'Cash Offer', exit: 'Fix & Flip / BRRRR',   eligible: wholesale.eligible && (brrrr?.eligible ?? false), score: Math.round((wholesale.dealScore + (brrrr?.dealScore ?? 0)) / 2), note: `${fmt.currency(brrrr?.equityCapture ?? 0)} equity capture · ${fmt.currency(brrrr?.cashReturned ?? 0)} returned at refi` },
            { entry: 'Subject-To', exit: 'Buy & Hold / LTR',     eligible: subjectTo.eligible && subjectTo.cashFlowWithSubTo > 0, score: Math.round((subjectTo.dealScore + buyHoldScore) / 2), note: `${fmt.currency(subjectTo.totalCashToClose)} to close · ${fmt.currency(subjectTo.cashFlowWithSubTo)}/mo cash flow` },
            { entry: 'Cash Offer', exit: 'DSCR Loan / STR',      eligible: airbnb.ltrQualifies || airbnb.strQualifies, score: airbnb.dealScore, note: `${fmt.currency(airbnb.dscrDownPayment)} down · DSCR ${(airbnb.ltrDSCR ?? 0).toFixed(2)}x · ${fmt.currency(airbnb.ltrMonthlyCashFlow ?? 0)}/mo LTR` },
            { entry: 'Listing',    exit: 'Traditional MLS Sale',  eligible: listGap_ <= 15_000, score: listingScore, note: `List ${fmt.currency(listPrice_)} · Net ${fmt.currency(listNet_)} · ${listGap_ >= 0 ? '+' : ''}${fmt.currency(listGap_)} vs cash offer` },
          ].map((row, i) => (
            <div key={i} className={`rounded-xl p-4 border ${row.eligible ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-900/40 border-slate-800/40 opacity-60'}`}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{row.entry}</p>
                  <p className="text-sm font-bold text-white">→ {row.exit}</p>
                </div>
                <p className={`text-lg font-extrabold ${row.score >= 60 ? 'text-emerald-400' : row.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{row.score}</p>
              </div>
              <p className="text-xs text-slate-500 mt-1">{row.note}</p>
              <p className={`text-xs font-semibold mt-1.5 ${row.eligible ? 'text-emerald-400' : 'text-slate-600'}`}>{row.eligible ? '✓ Viable' : '✗ Not viable at this price'}</p>
            </div>
          ))}
        </div>

        {aiAnalysis?.recommendedStrategy && (
          <div className="mt-4 rounded-xl px-4 py-3 bg-cyan-500/10 border border-cyan-500/30">
            <p className="text-xs text-cyan-400 font-semibold mb-1">AI Recommended Structure</p>
            <p className="text-sm text-white font-bold">{STRATEGY_LABELS[aiAnalysis.recommendedStrategy]}</p>
          </div>
        )}
      </div>

      {/* ── Neighborhood Intelligence (ATTOM) ── */}
      {result.neighborhood && (
        <NeighborhoodPanel neighborhood={result.neighborhood} />
      )}

      {/* ── Market Grade ── */}
      {aiAnalysis && (
        <MarketGradeCard grade={aiAnalysis.marketGrade} />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onReset} className="btn-secondary">← Analyze Another Deal</button>
        <button
          onClick={downloadAcquisitionsReport}
          disabled={generatingAcq}
          className="btn-secondary flex items-center gap-2"
        >
          {generatingAcq ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating...
            </>
          ) : <>📋 Acquisitions Report</>}
        </button>
        {/* Seller offer editor + report button */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
          <span className="text-xs text-slate-400 shrink-0">Our Offer:</span>
          {editingOffer ? (
            <input
              type="number"
              autoFocus
              defaultValue={ourOffer > 0 ? ourOffer : mao}
              onBlur={e => { setOurOffer(Number(e.target.value) || 0); setEditingOffer(false) }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { setOurOffer(Number((e.target as HTMLInputElement).value) || 0); setEditingOffer(false) } }}
              className="w-28 bg-slate-700 text-white text-sm font-bold rounded-lg px-2 py-1 border border-cyan-500 outline-none"
            />
          ) : (
            <button type="button" onClick={() => setEditingOffer(true)}
              className="text-sm font-bold text-white hover:text-cyan-400 transition-colors min-w-[80px] text-left">
              {fmt.currency(ourOffer > 0 ? ourOffer : mao)}
            </button>
          )}
          {ourOffer > 0 && ourOffer < mao && (
            <span className="text-xs text-emerald-400 font-semibold shrink-0">+{fmt.currency(mao - ourOffer)} spread</span>
          )}
          {ourOffer > 0 && ourOffer > mao && (
            <span className="text-xs text-red-400 font-semibold shrink-0">{fmt.currency(ourOffer - mao)} over MAO</span>
          )}
          <button type="button" onClick={() => setEditingOffer(true)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0">✎</button>
          <button
            onClick={downloadSellerReport}
            disabled={generatingSeller}
            className="btn-secondary flex items-center gap-2 ml-1 shrink-0"
          >
            {generatingSeller ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating...
              </>
            ) : <>🏠 Seller Report</>}
          </button>
        </div>
        <button
          onClick={downloadReport}
          disabled={generatingPDF}
          className="btn-primary flex items-center gap-2"
        >
          {generatingPDF ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating Report...
            </>
          ) : (
            <>📄 Download Investor Report</>
          )}
        </button>
      </div>
    </div>
  )
}
