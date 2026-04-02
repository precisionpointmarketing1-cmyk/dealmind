'use client'

import { useState } from 'react'
import { SavedDeal, useDealsStore } from '@/store/deals'
import { fmt } from '@/lib/utils/formatters'
import { STRATEGY_LABELS } from '@/lib/utils/constants'

interface Props {
  deal: SavedDeal
  onOpen: (deal: SavedDeal) => void
}

export default function SavedDealCard({ deal, onOpen }: Props) {
  const { deleteDeal, renameDeal } = useDealsStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(deal.nickname ?? '')

  const r = deal.result
  const mao = r.coreMetrics.mao
  const arv = r.arv.adjustedARV
  const assignmentProfit = r.wholesale.wholesaleFee   // projected profit if deal is assigned (wholesale or sub-to)

  // Listing score
  const listPrice    = Math.round(arv * 0.97)
  const listNet      = listPrice - Math.round(listPrice * 0.055) - Math.round(listPrice * 0.01)
  const listGap      = listNet - (r.input.askingPrice > 0 ? r.input.askingPrice : mao)
  const listingScore = listGap <= 0 ? 88 : listGap <= 15_000 ? 68 : listGap <= 35_000 ? 45 : listGap <= 60_000 ? 25 : 12

  const topStrategy = [...[
    { key: 'cash-offer',  score: r.wholesale.dealScore },
    { key: 'subject-to',  score: r.subjectTo.dealScore },
    { key: 'listing',     score: listingScore },
  ]].sort((a, b) => b.score - a.score)[0]

  const scoreColor = topStrategy.score >= 70 ? 'text-cyan-400' : topStrategy.score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const label = deal.nickname ?? `${r.input.address}, ${r.input.city}`

  // Hero image: first uploaded photo, or Street View as fallback
  const heroPhoto = r.propertyPhotos?.[0] ?? null
  const streetViewKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY ?? ''
  const streetViewUrl = streetViewKey
    ? `https://maps.googleapis.com/maps/api/streetview?size=640x200&location=${encodeURIComponent(`${r.input.address}, ${r.input.city}, ${r.input.state}`)}&key=${streetViewKey}`
    : null
  const heroSrc = heroPhoto ?? streetViewUrl

  function saveNickname() {
    if (name.trim()) renameDeal(deal.id, name.trim())
    setEditing(false)
  }

  return (
    <div className="card overflow-hidden hover:border-cyan-500/30 transition-all duration-200 group">

      {/* Hero image */}
      {heroSrc ? (
        <div className="relative w-full h-36 bg-slate-800 overflow-hidden">
          <img
            src={heroSrc}
            alt={r.input.address}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <p className="text-xs font-semibold text-white drop-shadow">{r.input.address}</p>
            <p className="text-xs text-slate-300 drop-shadow">{r.input.city}, {r.input.state}</p>
          </div>
        </div>
      ) : (
        <div className="w-full h-12 bg-slate-800/60" />
      )}

      <div className="p-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveNickname}
              onKeyDown={e => e.key === 'Enter' && saveNickname()}
              className="input text-sm py-1.5 px-2"
              placeholder="Add nickname..."
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-white text-left truncate w-full hover:text-cyan-400 transition-colors"
              title="Click to rename"
            >
              {label}
            </button>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            {!heroSrc && `${r.input.city}, ${r.input.state} · `}{new Date(deal.savedAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => deleteDeal(deal.id)}
          className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-navy-900/60 rounded-lg p-2 text-center">
          <p className="text-xs text-slate-500">MAO</p>
          <p className="text-sm font-bold text-white">{fmt.currency(mao)}</p>
        </div>
        <div className="bg-navy-900/60 rounded-lg p-2 text-center">
          <p className="text-xs text-slate-500">ARV</p>
          <p className="text-sm font-bold text-white">{fmt.currency(arv)}</p>
        </div>
      </div>
      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2 text-center mb-3">
        <p className="text-xs text-slate-500">Projected Assignment Profit</p>
        <p className={`text-base font-bold ${assignmentProfit > 0 ? 'text-cyan-400' : 'text-slate-400'}`}>
          {assignmentProfit > 0 ? fmt.currency(assignmentProfit) : '—'}
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">wholesale or sub-to assignment</p>
      </div>

      {/* Strategy badge */}
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400 flex items-center gap-1.5`}>
          {STRATEGY_LABELS[topStrategy.key as keyof typeof STRATEGY_LABELS]}
          <span className={`font-bold ${scoreColor}`}>{topStrategy.score}</span>
        </span>
        <button
          onClick={() => onOpen(deal)}
          className="text-xs text-slate-400 hover:text-white transition-colors font-medium"
        >
          View →
        </button>
      </div>
      </div>
    </div>
  )
}
