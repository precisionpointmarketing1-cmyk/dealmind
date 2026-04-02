'use client'

import { AttomNeighborhood } from '@/types/deal'

interface Props {
  neighborhood: AttomNeighborhood
}

function gradeColor(g?: string) {
  if (!g) return 'text-slate-400'
  if (g === 'A') return 'text-emerald-400'
  if (g === 'B') return 'text-blue-400'
  if (g === 'C') return 'text-yellow-400'
  if (g === 'D') return 'text-orange-400'
  return 'text-red-500'
}

function gradeBg(g?: string) {
  if (!g) return 'bg-slate-700/40 border-slate-600/40'
  if (g === 'A') return 'bg-emerald-500/10 border-emerald-500/30'
  if (g === 'B') return 'bg-blue-500/10 border-blue-500/30'
  if (g === 'C') return 'bg-yellow-500/10 border-yellow-500/30'
  if (g === 'D') return 'bg-orange-500/10 border-orange-500/30'
  return 'bg-red-500/10 border-red-500/30'
}

function crimeLabel(index?: number) {
  if (!index) return { label: '—', color: 'text-slate-400' }
  if (index <= 50)  return { label: 'Very Safe',  color: 'text-emerald-400' }
  if (index <= 100) return { label: 'Below Avg',  color: 'text-blue-400' }
  if (index <= 150) return { label: 'Average',    color: 'text-yellow-400' }
  if (index <= 200) return { label: 'Above Avg',  color: 'text-orange-400' }
  return { label: 'High Crime', color: 'text-red-400' }
}

function schoolTypeIcon(type: string) {
  if (type === 'elementary') return '🏫'
  if (type === 'middle')     return '🏛️'
  if (type === 'high')       return '🎓'
  return '📚'
}

function ratingColor(r?: number) {
  if (!r) return 'text-slate-500'
  if (r >= 8) return 'text-emerald-400'
  if (r >= 6) return 'text-blue-400'
  if (r >= 4) return 'text-yellow-400'
  return 'text-red-400'
}

export default function NeighborhoodPanel({ neighborhood: n }: Props) {
  const crime = crimeLabel(n.crimeIndex)

  const stats = [
    { label: 'Median Home Value',  value: n.medianHomeValue        ? `$${(n.medianHomeValue / 1000).toFixed(0)}k`        : '—' },
    { label: 'Median HH Income',   value: n.medianHouseholdIncome  ? `$${(n.medianHouseholdIncome / 1000).toFixed(0)}k`  : '—' },
    { label: 'Median Sale Price',  value: n.medianSalePrice        ? `$${(n.medianSalePrice / 1000).toFixed(0)}k`        : '—' },
    { label: 'Avg Days on Market', value: n.medianDaysOnMarket     ? `${n.medianDaysOnMarket} days`                      : '—' },
    { label: 'Sales (12 mo)',      value: n.salesVolume12mo        ? String(n.salesVolume12mo)                           : '—' },
    { label: 'Owner Occupied',     value: n.ownerOccupiedPct       ? `${n.ownerOccupiedPct.toFixed(0)}%`                 : '—' },
    { label: 'Renter Occupied',    value: n.renterOccupiedPct      ? `${n.renterOccupiedPct.toFixed(0)}%`                : '—' },
  ]

  return (
    <div className="card p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Neighborhood Intelligence</h3>
        <span className="text-xs text-slate-500 uppercase tracking-wider">ATTOM Data</span>
      </div>

      {/* Market Grade + Crime side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-4 border ${gradeBg(n.marketGrade)} flex flex-col items-center justify-center`}>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Market Grade</p>
          <p className={`text-4xl font-extrabold ${gradeColor(n.marketGrade)}`}>
            {n.marketGrade ?? '—'}
          </p>
          {n.marketGradeScore != null && (
            <p className="text-xs text-slate-500 mt-1">{n.marketGradeScore}/100</p>
          )}
        </div>
        <div className="rounded-xl p-4 border border-slate-700/50 bg-slate-800/40 flex flex-col items-center justify-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Crime Index</p>
          <p className={`text-2xl font-bold ${crime.color}`}>{n.crimeIndex ?? '—'}</p>
          <p className={`text-xs font-medium mt-1 ${crime.color}`}>{crime.label}</p>
          <p className="text-xs text-slate-600 mt-0.5">Natl avg = 100</p>
        </div>
      </div>

      {/* Community stats */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1 leading-tight">{s.label}</p>
            <p className="text-sm font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Schools */}
      {n.schools.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-300">Nearby Schools</p>
            {n.schoolDistrictName && (
              <p className="text-xs text-slate-500">{n.schoolDistrictName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            {n.schools.slice(0, 8).map((school, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">{schoolTypeIcon(school.type)}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{school.name}</p>
                    <p className="text-xs text-slate-500 capitalize">
                      {school.type}{school.gradeRange ? ` · ${school.gradeRange}` : ''}{school.distance ? ` · ${school.distance.toFixed(1)}mi` : ''}
                    </p>
                  </div>
                </div>
                {school.rating != null ? (
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className={`text-sm font-bold ${ratingColor(school.rating)}`}>{school.rating}</span>
                    <span className="text-xs text-slate-600">/10</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-600 shrink-0 ml-2">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
