import { MarketGrade } from '@/types/deal'

interface Props {
  grade: MarketGrade
}

function gradeColor(g: string) {
  if (g.startsWith('A')) return 'text-emerald-400'
  if (g.startsWith('B')) return 'text-blue-400'
  if (g.startsWith('C')) return 'text-yellow-400'
  if (g.startsWith('D')) return 'text-orange-400'
  return 'text-red-500'
}

export default function MarketGradeCard({ grade }: Props) {
  const categories = [
    { label: 'Market Conditions', value: grade.marketConditions },
    { label: 'Local Market', value: grade.localMarket },
    { label: 'Population Trend', value: grade.populationTrend },
    { label: 'Rent Growth', value: grade.rentGrowth },
    { label: 'Supply & Demand', value: grade.supplyDemand },
  ]

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Market Grade</h3>
        <div className="text-center">
          <span className={`text-5xl font-extrabold ${gradeColor(grade.overall)}`}>{grade.overall}</span>
        </div>
      </div>

      <p className="text-sm text-slate-400 mb-4">{grade.summary}</p>

      <div className="space-y-2 mb-4">
        {categories.map(c => (
          <div key={c.label} className="flex items-center justify-between">
            <span className="text-sm text-slate-400">{c.label}</span>
            <span className={`text-sm font-bold ${gradeColor(c.value)}`}>{c.value}</span>
          </div>
        ))}
      </div>

      {grade.bullPoints.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Bulls</p>
          <ul className="space-y-0.5">
            {grade.bullPoints.map((p, i) => (
              <li key={i} className="text-xs text-slate-400">{p}</li>
            ))}
          </ul>
        </div>
      )}

      {grade.bearPoints.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Bears</p>
          <ul className="space-y-0.5">
            {grade.bearPoints.map((p, i) => (
              <li key={i} className="text-xs text-slate-400">{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
