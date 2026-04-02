import { ARVResult } from '@/types/deal'
import { fmt } from '@/lib/utils/formatters'

interface Props {
  arv: ARVResult
  userEstimate: number
  selectedCompsARV?: number   // derived from user-selected sold comps
}

export default function ARVComparisonPanel({ arv, userEstimate, selectedCompsARV }: Props) {
  const estimates = [
    {
      label: 'RentCast AVM',
      value: arv.rentCastARV,
      desc: 'Automated valuation model',
      color: 'cyan',
    },
    {
      label: 'Comp $/sqft',
      value: arv.compBasedARV,
      desc: `Weighted price-per-sqft · ${arv.compsUsed} comps`,
      color: 'blue',
    },
    {
      label: 'Comp Median',
      value: arv.compMedianARV,
      desc: 'Median of sold comparables',
      color: 'indigo',
    },
    {
      label: 'HouseCanary',
      value: arv.housecanaryARV,
      desc: arv.housecanaryLow && arv.housecanaryHigh
        ? `${fmt.currency(arv.housecanaryLow)} – ${fmt.currency(arv.housecanaryHigh)}`
        : 'Institutional AVM',
      color: 'orange',
    },
    {
      label: 'Zillow Comps',
      value: arv.zillowARV,
      desc: 'HasData · recently sold',
      color: 'teal',
    },
    {
      label: 'ATTOM AVM',
      value: arv.attomARV,
      desc: arv.attomLow && arv.attomHigh
        ? `${fmt.currency(arv.attomLow)} – ${fmt.currency(arv.attomHigh)}`
        : 'ATTOM Data Solutions',
      color: 'rose',
    },
    {
      label: 'BatchData AVM',
      value: arv.batchDataARV,
      desc: 'BatchLeads property intelligence',
      color: 'orange',
    },
    {
      label: 'AI Estimate',
      value: arv.aiEstimatedARV,
      desc: 'Claude market analysis',
      color: 'purple',
    },
    {
      label: 'Selected Comps',
      value: selectedCompsARV && selectedCompsARV > 0 ? selectedCompsARV : undefined,
      desc: 'Avg $/sqft · your picks',
      color: 'emerald',
    },
    {
      label: 'Your Estimate',
      value: !selectedCompsARV && userEstimate > 0 ? userEstimate : undefined,
      desc: 'Manually entered',
      color: 'slate',
    },
  ].filter(e => e.value != null && e.value > 0) as {
    label: string; value: number; desc: string; color: string
  }[]

  const dataValues = estimates
    .filter(e => e.label !== 'Your Estimate')
    .map(e => e.value)

  const min = dataValues.length > 0 ? Math.min(...dataValues) : 0
  const max = dataValues.length > 0 ? Math.max(...dataValues) : 0
  const spread = max - min
  const spreadPct = max > 0 ? (spread / max) * 100 : 0

  const colorMap: Record<string, string> = {
    cyan:   'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    blue:   'text-blue-400 bg-blue-500/10 border-blue-500/30',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    teal:   'text-teal-400 bg-teal-500/10 border-teal-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    rose:    'text-rose-400 bg-rose-500/10 border-rose-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    slate:   'text-slate-300 bg-slate-700/40 border-slate-600/40',
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">ARV Estimates</h3>
        <div className="text-right">
          <p className="text-xs text-slate-500">Consensus (used for calcs)</p>
          <p className="text-xl font-extrabold gradient-text">{fmt.currency(arv.adjustedARV)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
        {estimates.map(e => (
          <div key={e.label} className={`rounded-xl p-3 border ${colorMap[e.color]}`}>
            <p className="text-xs font-semibold mb-1 opacity-80">{e.label}</p>
            <p className="text-lg font-bold text-white">{fmt.currency(e.value)}</p>
            <p className="text-xs opacity-60 mt-0.5 leading-tight">{e.desc}</p>
          </div>
        ))}
      </div>

      {dataValues.length >= 2 && (
        <div className="flex items-center gap-4 pt-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Range:</span>
            <span className="text-white font-medium">{fmt.currency(min)} – {fmt.currency(max)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Spread:</span>
            <span className={`font-medium ${spreadPct < 5 ? 'text-emerald-400' : spreadPct < 10 ? 'text-yellow-400' : 'text-red-400'}`}>
              {fmt.currency(spread)} ({spreadPct.toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${arv.confidence === 'high' ? 'bg-emerald-400' : arv.confidence === 'medium' ? 'bg-yellow-400' : 'bg-red-400'}`} />
            <span className="text-slate-500">{arv.confidence} confidence · {arv.compsUsed} comps</span>
          </div>
        </div>
      )}
    </div>
  )
}
