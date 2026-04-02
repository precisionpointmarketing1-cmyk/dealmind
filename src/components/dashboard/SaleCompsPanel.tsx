'use client'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { SaleComp } from '@/types/deal'
import { fmt } from '@/lib/utils/formatters'

const CompMap = dynamic(() => import('./CompMap'), { ssr: false, loading: () => (
  <div className="h-96 rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-500 text-sm">Loading map...</div>
)})

interface Props {
  comps: SaleComp[]
  attomComps?: SaleComp[]           // ATTOM independent comps — shown as separate source tab
  subjectSqft: number
  repairs: number
  subjectAddress?: string
  subjectLat?: number
  subjectLng?: number
  subjectYearBuilt?: number
  onCompsSelected?: (comps: SaleComp[]) => void
  onARVChange?: (arv: number) => void
}

function fmtDate(d: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) } catch { return d }
}

function monthsAgo(dateStr: string) {
  if (!dateStr) return 999
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30)
}

const STATUS_COLORS = {
  sold:    { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Sold' },
  active:  { bg: 'bg-blue-500/20',   text: 'text-blue-400',    label: 'Active' },
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400',  label: 'Pending' },
}

export default function SaleCompsPanel({ comps, attomComps, subjectSqft, repairs, subjectAddress, subjectLat, subjectLng, subjectYearBuilt, onCompsSelected, onARVChange }: Props) {
  const hasSubjectCoords = !!(subjectLat && subjectLng)
  const [view, setView]         = useState<'list' | 'map'>(hasSubjectCoords ? 'map' : 'list')
  const [activeComp, setActive] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Source toggle — which dataset is active
  const [dataSource, setDataSource] = useState<'rentcast' | 'attom'>('rentcast')
  const activeComps = dataSource === 'attom' && attomComps?.length ? attomComps : comps

  // Status filter — exclusive single-select
  const [status, setStatus] = useState<'sold' | 'active' | 'pending'>('sold')

  // Compact filter bar
  const [filterBeds,   setFilterBeds]   = useState('')
  const [filterBaths,  setFilterBaths]  = useState('')
  const [filterDist,   setFilterDist]   = useState('')
  const [filterMonths, setFilterMonths] = useState('')
  const [filterPool,   setFilterPool]   = useState<'any' | 'yes' | 'no'>('any')

  // Range filters (advanced)
  const [filterSqftMin,  setFilterSqftMin]  = useState('')
  const [filterSqftMax,  setFilterSqftMax]  = useState('')
  const [filterPriceMin, setFilterPriceMin] = useState('')
  const [filterPriceMax, setFilterPriceMax] = useState('')
  const [filterPpsfMin,  setFilterPpsfMin]  = useState('')
  const [filterPpsfMax,  setFilterPpsfMax]  = useState('')

  const [sortBy, setSortBy] = useState<'likeability' | 'distance' | 'date' | 'price_hi' | 'price_lo' | 'ppsf_hi' | 'ppsf_lo'>('likeability')

  // Pre-filter: strip comps whose year built is more than 20 years from subject
  const yearFilteredComps = useMemo(() => {
    if (!subjectYearBuilt) return activeComps
    const tight = activeComps.filter(c => !c.yearBuilt || Math.abs(c.yearBuilt - subjectYearBuilt) <= 10)
    // If tight filter leaves fewer than 5 sold comps, loosen to ±20 years
    const tightSold = tight.filter(c => c.status === 'sold').length
    if (tightSold < 5) {
      return activeComps.filter(c => !c.yearBuilt || Math.abs(c.yearBuilt - subjectYearBuilt) <= 20)
    }
    return tight
  }, [activeComps, subjectYearBuilt])

  const filtered = useMemo(() => {
    let list = [...yearFilteredComps]

    list = list.filter(c => c.status === status)
    if (filterBeds)     list = list.filter(c => c.bedrooms  === Number(filterBeds))
    if (filterBaths)    list = list.filter(c => c.bathrooms >= Number(filterBaths))
    if (filterSqftMin)  list = list.filter(c => c.sqft >= Number(filterSqftMin))
    if (filterSqftMax)  list = list.filter(c => c.sqft <= Number(filterSqftMax))
    if (filterPriceMin) list = list.filter(c => c.salePrice >= Number(filterPriceMin))
    if (filterPriceMax) list = list.filter(c => c.salePrice <= Number(filterPriceMax))
    if (filterPpsfMin)  list = list.filter(c => c.pricePerSqft >= Number(filterPpsfMin))
    if (filterPpsfMax)  list = list.filter(c => c.pricePerSqft <= Number(filterPpsfMax))
    if (filterDist)     list = list.filter(c => c.distance  <= Number(filterDist))
    if (filterMonths)   list = list.filter(c => monthsAgo(c.soldDate) <= Number(filterMonths))
    if (filterPool === 'yes') list = list.filter(c => c.hasPool)
    if (filterPool === 'no')  list = list.filter(c => !c.hasPool)

    list.sort((a, b) => {
      if (sortBy === 'likeability') return (b.likeabilityScore ?? 0) - (a.likeabilityScore ?? 0)
      if (sortBy === 'distance')    return a.distance - b.distance
      if (sortBy === 'date')        return new Date(b.soldDate).getTime() - new Date(a.soldDate).getTime()
      if (sortBy === 'price_hi')    return b.salePrice - a.salePrice
      if (sortBy === 'price_lo')    return a.salePrice - b.salePrice
      if (sortBy === 'ppsf_hi')     return b.pricePerSqft - a.pricePerSqft
      if (sortBy === 'ppsf_lo')     return a.pricePerSqft - b.pricePerSqft
      return 0
    })
    return list
  }, [yearFilteredComps, status, filterBeds, filterBaths, filterSqftMin, filterSqftMax, filterPriceMin, filterPriceMax, filterPpsfMin, filterPpsfMax, filterDist, filterMonths, filterPool, sortBy])

  // Median $/sqft across ALL visible sold comps — used to flag distressed outliers
  // Must be declared before the useEffect and isDistressed function below
  const medianSoldPpsf = useMemo(() => {
    const vals = filtered
      .filter(c => c.status === 'sold' && c.sqft > 0 && c.salePrice > 0)
      .map(c => c.pricePerSqft || c.salePrice / c.sqft)
      .sort((a, b) => a - b)
    if (vals.length === 0) return 0
    const mid = Math.floor(vals.length / 2)
    return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid]
  }, [filtered])

  const [selected, setSelected] = useState<Set<number>>(() =>
    new Set(Array.from({ length: Math.min(5, filtered.length) }, (_, i) => i))
  )

  // When switching to sold tab or filters change, auto-select top 5 retail (non-distressed) comps
  useEffect(() => {
    if (status === 'sold') {
      const retailIndices = filtered
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => !isDistressed(c))
        .slice(0, 5)
        .map(({ i }) => i)
      setSelected(new Set(retailIndices))
    } else {
      setSelected(new Set()) // active/pending don't feed ARV
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, filterBeds, filterBaths, filterSqftMin, filterSqftMax, filterPriceMin, filterPriceMax, filterPpsfMin, filterPpsfMax, filterDist, filterMonths, filterPool, sortBy, medianSoldPpsf])

  function toggle(i: number) {
    setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  const selectedComps = useMemo(
    () => filtered.filter((_, i) => selected.has(i)),
    [filtered, selected]
  )
  const soldSelected  = useMemo(
    () => selectedComps.filter(c => c.status === 'sold'),
    [selectedComps]
  )

  // Notify parent whenever selection changes so the PDF uses these exact comps
  useEffect(() => {
    onCompsSelected?.(selectedComps)
  }, [selectedComps]) // eslint-disable-line react-hooks/exhaustive-deps

  // A comp is distressed if its $/sqft is < 75% of the median — broken house, not retail
  function isDistressed(comp: SaleComp) {
    if (medianSoldPpsf === 0 || comp.status !== 'sold' || comp.sqft <= 0) return false
    const ppsf = comp.pricePerSqft || comp.salePrice / comp.sqft
    return ppsf < medianSoldPpsf * 0.75
  }

  // ARV calc uses sold comps only
  const avgPpsf = soldSelected.length > 0
    ? soldSelected.reduce((s, c) => s + (c.pricePerSqft || (c.sqft > 0 ? c.salePrice / c.sqft : 0)), 0) / soldSelected.length
    : 0
  const derivedARV = subjectSqft > 0 && avgPpsf > 0 ? Math.round(avgPpsf * subjectSqft) : 0
  const derivedMAO = derivedARV > 0 ? Math.round(derivedARV * 0.70 - repairs) : 0

  useEffect(() => {
    onARVChange?.(derivedARV)
  }, [derivedARV]) // eslint-disable-line react-hooks/exhaustive-deps

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ''

  function satelliteUrl(comp: SaleComp) {
    if (!mapboxToken || !comp.lat || !comp.lng) return null
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-s+00c8ff(${comp.lng},${comp.lat})/${comp.lng},${comp.lat},17,0/640x240@2x?access_token=${mapboxToken}`
  }

  const hasFilters = !!(filterBeds || filterBaths || filterSqftMin || filterSqftMax ||
    filterPriceMin || filterPriceMax || filterPpsfMin || filterPpsfMax ||
    filterDist || filterMonths || filterPool !== 'any')

  const statusCounts = useMemo(() => ({
    sold:    yearFilteredComps.filter(c => c.status === 'sold').length,
    active:  yearFilteredComps.filter(c => c.status === 'active').length,
    pending: yearFilteredComps.filter(c => c.status === 'pending').length,
  }), [yearFilteredComps])

  function clearFilters() {
    setFilterBeds(''); setFilterBaths(''); setFilterSqftMin(''); setFilterSqftMax('')
    setFilterPriceMin(''); setFilterPriceMax(''); setFilterPpsfMin(''); setFilterPpsfMax('')
    setFilterDist(''); setFilterMonths(''); setFilterPool('any')
  }

  if (!comps.length && !attomComps?.length) return null

  const selCls = 'bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500/50 transition-colors'
  const rangeCls = 'bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-slate-600'
  const hasAdvanced = !!(filterSqftMin || filterSqftMax || filterPriceMin || filterPriceMax || filterPpsfMin || filterPpsfMax || filterPool !== 'any')

  return (
    <div className="card p-6">

      {/* ── Header row: title + source tabs + sort + view ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-white">Comparables</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {filtered.length} shown · {selected.size} selected for ARV
              {subjectYearBuilt ? ` · ±10 yr built filter active` : ''}
            </p>
          </div>
          {/* Data source toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700/60">
            <button onClick={() => setDataSource('rentcast')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${dataSource === 'rentcast' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>
              All <span className="ml-1 opacity-60">{comps.length}</span>
            </button>
            {attomComps && attomComps.length > 0 && (
              <button onClick={() => setDataSource('attom')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${dataSource === 'attom' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-slate-200'}`}>
                ATTOM only <span className="ml-1 opacity-60">{attomComps.length}</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className={selCls}>
            <option value="likeability">Best match</option>
            <option value="distance">Nearest</option>
            <option value="price_hi">Price ↓</option>
            <option value="price_lo">Price ↑</option>
            <option value="ppsf_hi">$/sqft ↓</option>
            <option value="ppsf_lo">$/sqft ↑</option>
          </select>
          <div className="flex rounded-lg overflow-hidden border border-slate-700/60">
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              List
            </button>
            <button onClick={() => setView('map')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'map' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              Map
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap mb-4">

        {/* Status tabs — exclusive single-select */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700/60 shrink-0">
          {(['sold', 'active', 'pending'] as const).map(s => {
            const count = statusCounts[s]
            const active = status === s
            const colors = { sold: 'bg-emerald-500/20 text-emerald-300', active: 'bg-blue-500/20 text-blue-300', pending: 'bg-yellow-500/20 text-yellow-300' }
            return (
              <button key={s} onClick={() => count > 0 && setStatus(s)}
                disabled={count === 0}
                title={count === 0 ? `No ${s} comps in this area` : undefined}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize flex items-center gap-1 ${
                  count === 0 ? 'text-slate-600 cursor-not-allowed' :
                  active ? colors[s] : 'text-slate-400 hover:text-slate-200'
                }`}>
                {s}
                <span className={`text-xs ${count === 0 ? 'text-slate-700' : active ? 'opacity-70' : 'opacity-40'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Beds */}
        <select value={filterBeds} onChange={e => setFilterBeds(e.target.value)} className={selCls}>
          <option value="">Any beds</option>
          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} bd</option>)}
        </select>

        {/* Baths */}
        <select value={filterBaths} onChange={e => setFilterBaths(e.target.value)} className={selCls}>
          <option value="">Any baths</option>
          {[1,1.5,2,2.5,3].map(n => <option key={n} value={n}>{n}+ ba</option>)}
        </select>

        {/* Distance */}
        <select value={filterDist} onChange={e => setFilterDist(e.target.value)} className={selCls}>
          <option value="">Any distance</option>
          <option value="0.5">≤ 0.5 mi</option>
          <option value="1">≤ 1 mi</option>
          <option value="2">≤ 2 mi</option>
          <option value="5">≤ 5 mi</option>
        </select>

        {/* Period (only meaningful for sold) */}
        {status === 'sold' && (
          <select value={filterMonths} onChange={e => setFilterMonths(e.target.value)} className={selCls}>
            <option value="">Any period</option>
            <option value="3">Last 3 mo</option>
            <option value="6">Last 6 mo</option>
            <option value="12">Last 1 yr</option>
            <option value="24">Last 2 yr</option>
          </select>
        )}

        {/* Advanced toggle */}
        <button onClick={() => setShowAdvanced(p => !p)}
          className={`px-3 py-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
            hasAdvanced ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-500'
          }`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
          More{hasAdvanced ? ' •' : ''}
        </button>

        {/* Clear */}
        {hasFilters && (
          <button onClick={clearFilters}
            className="px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs text-slate-500 hover:text-red-400 hover:border-red-500/40 transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            Clear
          </button>
        )}
      </div>

      {/* ── Advanced filter panel ── */}
      {showAdvanced && (
        <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Sqft range</p>
              <div className="flex items-center gap-2">
                <input type="number" value={filterSqftMin} onChange={e => setFilterSqftMin(e.target.value)} placeholder="Min" className={rangeCls} />
                <span className="text-slate-600 text-xs">–</span>
                <input type="number" value={filterSqftMax} onChange={e => setFilterSqftMax(e.target.value)} placeholder="Max" className={rangeCls} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Price range</p>
              <div className="flex items-center gap-2">
                <input type="number" value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)} placeholder="Min $" className={rangeCls} />
                <span className="text-slate-600 text-xs">–</span>
                <input type="number" value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)} placeholder="Max $" className={rangeCls} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">$/sqft range</p>
              <div className="flex items-center gap-2">
                <input type="number" value={filterPpsfMin} onChange={e => setFilterPpsfMin(e.target.value)} placeholder="Min" className={rangeCls} />
                <span className="text-slate-600 text-xs">–</span>
                <input type="number" value={filterPpsfMax} onChange={e => setFilterPpsfMax(e.target.value)} placeholder="Max" className={rangeCls} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-500 font-medium">Pool</span>
            {[['any','Any'],['yes','With pool'],['no','No pool']].map(([v, label]) => (
              <button key={v} onClick={() => setFilterPool(v as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filterPool === v ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:border-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Map view ── */}
      {view === 'map' && (
        <div className="mb-4">
          <CompMap comps={filtered} selected={selected} onToggle={toggle} subjectLat={subjectLat} subjectLng={subjectLng} subjectAddress={subjectAddress} />
          <p className="text-xs text-slate-500 mt-2 text-center">Subject property = gold marker · Click pin to toggle · Cyan = included in ARV</p>
        </div>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="space-y-1.5 mb-4">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-3 pb-1">
            {['Address', 'Beds/Ba', 'Sqft', '$/sqft', 'Price', ''].map(h => (
              <p key={h} className="text-xs text-slate-600 font-medium">{h}</p>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400 mb-1">
                {statusCounts[status] === 0
                  ? `No ${status} listings found in this area`
                  : 'No comps match your current filters'}
              </p>
              {statusCounts[status] === 0 && status !== 'sold' && (
                <p className="text-xs text-slate-600">RentCast found no {status} listings near this zip — try switching to Sold</p>
              )}
              {hasFilters && statusCounts[status] > 0 && (
                <button onClick={clearFilters} className="text-xs text-cyan-400 hover:text-cyan-300 mt-1">Clear filters</button>
              )}
            </div>
          )}

          {filtered.map((comp, i) => {
            const ppsf = comp.pricePerSqft || (comp.sqft > 0 ? comp.salePrice / comp.sqft : 0)
            const isSelected = selected.has(i)
            const isActive   = activeComp === i
            const sc = STATUS_COLORS[comp.status]
            return (
              <div key={i}>
                <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-cyan-500/30'
                    : 'border-slate-700/40 bg-slate-800/20 opacity-55 hover:opacity-75'
                }`} style={isSelected ? { background: 'rgba(0,200,255,0.05)' } : {}}>

                  {/* Checkbox */}
                  <div onClick={() => toggle(i)}
                    className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center cursor-pointer ${
                      isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'
                    }`}>
                    {isSelected && <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>

                  {/* Status badge */}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${sc.bg} ${sc.text}`}>{sc.label}</span>

                  {/* Distressed flag — low $/sqft means broken house, not a retail comp */}
                  {isDistressed(comp) && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold shrink-0 bg-red-500/20 text-red-400 border border-red-500/30"
                      title={`$/sqft is ${Math.round(((comp.pricePerSqft || comp.salePrice / comp.sqft) / medianSoldPpsf) * 100)}% of median — likely distressed/broken house, not a retail ARV comp`}>
                      Distressed
                    </span>
                  )}

                  {/* Likeability score badge */}
                  {comp.likeabilityScore != null && !isDistressed(comp) && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                      comp.likeabilityScore >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                      comp.likeabilityScore >= 45 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-700/60 text-slate-500'
                    }`} title="Similarity score vs subject property">
                      {comp.likeabilityScore}%
                    </span>
                  )}

                  {/* Address */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(i)}>
                    <p className="text-sm font-medium text-white truncate">{comp.address}</p>
                    <p className="text-xs text-slate-500">
                      {comp.bedrooms}bd/{comp.bathrooms}ba
                      {comp.sqft > 0 ? ` · ${comp.sqft.toLocaleString()} sqft` : ''}
                      {comp.lotSize ? ` · ${comp.lotSize.toLocaleString()} lot` : ''}
                      {comp.hasPool ? ' · 🏊 Pool' : ''}
                      {' · '}{fmtDate(comp.soldDate)}
                      {comp.daysOnMarket != null ? ` · ${comp.daysOnMarket} DOM` : ''}
                    </p>
                  </div>

                  {/* Distance */}
                  <p className="text-xs text-slate-400 shrink-0 hidden md:block">{comp.distance?.toFixed(2)} mi</p>

                  {/* $/sqft */}
                  <p className="text-xs font-medium text-slate-300 shrink-0 hidden sm:block w-16 text-right">
                    {ppsf > 0 ? `$${Math.round(ppsf)}/ft²` : '—'}
                  </p>

                  {/* Price */}
                  <p className="text-sm font-bold text-white shrink-0 w-24 text-right">{fmt.currency(comp.salePrice)}</p>

                  {/* Photo button */}
                  <button onClick={e => { e.stopPropagation(); setActive(isActive ? null : i) }}
                    className={`shrink-0 text-xs px-2 py-1 rounded-lg border transition-colors ${
                      isActive ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
                    }`}>📷</button>
                </div>

                {/* Detail panel */}
                {isActive && (
                  <div className="mt-1 ml-6 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900/80">
                    {/* MLS photos from Repliers — shown as horizontal scroll strip */}
                    {comp.photos && comp.photos.length > 0 && (
                      <div className="relative bg-slate-900">
                        <div className="flex overflow-x-auto gap-1 p-1" style={{ scrollbarWidth: 'thin' }}>
                          {comp.photos.map((src, pi) => (
                            <img key={pi} src={src} alt={`${comp.address} photo ${pi + 1}`}
                              className="shrink-0 rounded object-cover"
                              style={{ height: 180, width: 260 }}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ))}
                        </div>
                        <span className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded-lg font-medium">MLS Photos</span>
                      </div>
                    )}
                    {/* Satellite fallback when no MLS photos */}
                    {(!comp.photos || comp.photos.length === 0) && satelliteUrl(comp) && (
                      <div className="relative bg-slate-800">
                        <img src={satelliteUrl(comp)!} alt={comp.address}
                          className="w-full object-cover" style={{ height: 220 }}
                          onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                        <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">Satellite View</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-slate-700/20">
                      {[
                        { l: 'Sale Price',  v: fmt.currency(comp.salePrice) },
                        { l: '$/Sqft',      v: ppsf > 0 ? `$${Math.round(ppsf)}` : '—' },
                        { l: 'Beds / Baths',v: `${comp.bedrooms}/${comp.bathrooms}` },
                        { l: 'Sqft',        v: comp.sqft > 0 ? comp.sqft.toLocaleString() : '—' },
                        { l: 'Distance',    v: `${comp.distance?.toFixed(2)} mi` },
                        { l: comp.status === 'sold' ? 'Sold' : 'Listed', v: fmtDate(comp.soldDate) },
                        ...(comp.lotSize ? [{ l: 'Lot Size', v: `${comp.lotSize.toLocaleString()} sqft` }] : []),
                        ...(comp.yearBuilt ? [{ l: 'Year Built', v: String(comp.yearBuilt) }] : []),
                        ...(comp.hasPool !== undefined ? [{ l: 'Pool', v: comp.hasPool ? 'Yes 🏊' : 'No' }] : []),
                        ...(comp.daysOnMarket != null ? [{ l: 'Days on Mkt', v: String(comp.daysOnMarket) }] : []),
                        ...(comp.likeabilityScore != null ? [{ l: 'Match Score', v: `${comp.likeabilityScore}%` }] : []),
                      ].map(item => (
                        <div key={item.l} className="bg-slate-800/80 px-3 py-2">
                          <p className="text-xs text-slate-500">{item.l}</p>
                          <p className="text-sm font-semibold text-white">{item.v}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex border-t border-slate-700/50">
                      {comp.lat && comp.lng && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${comp.lat},${comp.lng}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-cyan-400 hover:text-cyan-300 border-r border-slate-700/50">
                          📍 Google Maps →
                        </a>
                      )}
                      <a href={`https://www.zillow.com/homes/${encodeURIComponent(comp.address)}_rb/`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-blue-400 hover:text-blue-300">
                        🏠 Zillow →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── ARV summary (sold comps only) ── */}
      <div className="border-t border-slate-700/50 pt-4">
        {soldSelected.length > 0 && derivedARV > 0 ? (
          <>
            <p className="text-xs text-slate-500 mb-3">
              ARV from {soldSelected.length} sold comp{soldSelected.length !== 1 ? 's' : ''} · avg ${Math.round(avgPpsf)}/sqft × {subjectSqft.toLocaleString()} sqft
              {selectedComps.length > soldSelected.length && ` · (${selectedComps.length - soldSelected.length} active/pending excluded from ARV)`}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Comps ARV</p>
                <p className="text-xl font-bold text-white">{fmt.currency(derivedARV)}</p>
                <p className="text-xs text-slate-500">avg $/sqft method</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Avg $/Sqft</p>
                <p className="text-xl font-bold text-white">${Math.round(avgPpsf)}</p>
                <p className="text-xs text-slate-500">{soldSelected.length} sold comps</p>
              </div>
              <div className="rounded-xl p-3"
                style={{ background: 'linear-gradient(135deg,rgba(0,200,255,.12),rgba(0,102,204,.12))', border: '1px solid rgba(0,200,255,.25)' }}>
                <p className="text-xs text-slate-500 mb-0.5">Comps MAO</p>
                <p className="text-xl font-bold text-white">{fmt.currency(derivedMAO)}</p>
                <p className="text-xs text-slate-500">ARV × 70% − repairs</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500 text-center py-1">
            {selected.size > 0 ? 'Select sold comps to calculate ARV (active/pending excluded)' : 'Check comps to calculate ARV'}
          </p>
        )}
      </div>
    </div>
  )
}
