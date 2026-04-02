'use client'

interface Issue {
  description: string
  estimatedCost: number
  photos?: string[]
}

interface Props {
  knownIssues?: Issue[]
  repairNotes?: string
  totalRepairs: number
}

export default function RepairDetailsPanel({ knownIssues, repairNotes, totalRepairs }: Props) {
  if (!knownIssues?.length && !repairNotes) return null

  const itemizedTotal = (knownIssues ?? []).reduce((s, i) => s + (i.estimatedCost ?? 0), 0)

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Known Issues &amp; Repair Details</h3>
          <p className="text-xs text-slate-500 mt-0.5">Documented repairs and conditions from property walkthrough</p>
        </div>
        {itemizedTotal > 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Itemized Total</p>
            <p className="text-xl font-bold text-orange-400">${itemizedTotal.toLocaleString()}</p>
          </div>
        )}
      </div>

      {knownIssues && knownIssues.length > 0 && (
        <div className="space-y-3 mb-4">
          {knownIssues.map((issue, i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700/40 overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                    {i + 1}
                  </span>
                  <p className="text-sm text-white leading-snug">{issue.description}</p>
                </div>
                {issue.estimatedCost > 0 && (
                  <p className="text-sm font-bold text-orange-400 shrink-0">${issue.estimatedCost.toLocaleString()}</p>
                )}
              </div>
              {issue.photos && issue.photos.length > 0 && (
                <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
                  {issue.photos.map((src, pi) => (
                    <img
                      key={pi}
                      src={src}
                      alt={`Issue ${i + 1} photo ${pi + 1}`}
                      className="w-24 h-24 rounded-lg object-cover border border-slate-600 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(src, '_blank')}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {repairNotes && (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Additional Notes</p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{repairNotes}</p>
        </div>
      )}

      {itemizedTotal > 0 && itemizedTotal !== totalRepairs && (
        <p className="mt-3 text-xs text-slate-500">
          Itemized: <span className="text-orange-400 font-semibold">${itemizedTotal.toLocaleString()}</span>
          {' · '}Repair budget used in analysis: <span className="text-white font-semibold">${totalRepairs.toLocaleString()}</span>
        </p>
      )}
    </div>
  )
}
