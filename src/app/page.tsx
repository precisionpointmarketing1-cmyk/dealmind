'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import DealInputForm from '@/components/forms/DealInputForm'
import AnalysisDashboard from '@/components/dashboard/AnalysisDashboard'
import SavedDealCard from '@/components/dashboard/SavedDealCard'
import { useDealsStore, SavedDeal } from '@/store/deals'
import { AnalysisResult, DealInput, RehabScan } from '@/types/deal'

type View = 'home' | 'intake' | 'result'

export default function Home() {
  const [view, setView] = useState<View>('home')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [pendingRehabScan, setPendingRehabScan] = useState<RehabScan | null>(null)
  const [sessionPhotos, setSessionPhotos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { deals, loadDeals, saveDeal } = useDealsStore()
  const router = useRouter()

  useEffect(() => { loadDeals() }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  async function handleAnalyze(input: DealInput) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Analysis failed')
      }
      const data: AnalysisResult = await res.json()
      // Attach photo scan data if we have it
      if (pendingRehabScan) {
        data.rehabScan = pendingRehabScan
        setPendingRehabScan(null)
      }
      if (sessionPhotos.length > 0) {
        data.propertyPhotos = sessionPhotos
      }
      await saveDeal(data)
      setResult(data)
      setView('result')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function openSavedDeal(deal: SavedDeal) {
    setResult(deal.result)
    if (deal.result.propertyPhotos?.length) setSessionPhotos(deal.result.propertyPhotos)
    setView('result')
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--navy-900)' }}>

      {/* ── Header ── */}
      <header className="border-b border-slate-700/40 sticky top-0 z-50"
        style={{ background: 'rgba(11, 15, 30, 0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setView('home')} className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="DealMind AI" width={160} height={52} className="rounded-lg object-contain" priority />
          </button>

          <div className="flex items-center gap-2">
            {view === 'result' && (
              <button onClick={() => setView('home')} className="btn-secondary text-sm">
                ← Back
              </button>
            )}
            {view !== 'intake' && (
              <button
                onClick={() => { setError(null); setView('intake') }}
                className="btn-primary text-sm py-2 px-4"
              >
                + Analyze Property
              </button>
            )}
            <button onClick={() => router.push('/settings')} className="btn-secondary text-sm py-2 px-3" title="Settings">
              ⚙
            </button>
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-300 transition-colors px-2">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Views ── */}
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Home: saved deals dashboard ── */}
        {view === 'home' && (
          <div>
            {deals.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <Image src="/logo.png" alt="DealMind AI" width={100} height={100} className="rounded-2xl mb-6 opacity-90" />
                <h2 className="text-3xl font-extrabold text-white mb-3">
                  Know Your <span className="gradient-text">Max Offer</span> Instantly
                </h2>
                <p className="text-slate-400 text-lg max-w-xl mb-8">
                  Enter any property address — DealMind AI pulls RentCast data, calculates your MAO, and ranks every exit strategy in seconds.
                </p>
                <button
                  onClick={() => setView('intake')}
                  className="btn-primary text-lg py-4 px-10"
                >
                  + Analyze Your First Property
                </button>
              </div>
            ) : (
              /* Saved deals grid */
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Saved Deals</h2>
                    <p className="text-sm text-slate-400 mt-0.5">{deals.length} propert{deals.length === 1 ? 'y' : 'ies'} analyzed</p>
                  </div>
                  <button onClick={() => setView('intake')} className="btn-primary text-sm py-2 px-5">
                    + Add Property
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deals.map(deal => (
                    <SavedDealCard key={deal.id} deal={deal} onOpen={openSavedDeal} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Intake: deal input form ── */}
        {view === 'intake' && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">Analyze a Property</h2>
              <p className="text-slate-400 text-sm">
                Enter the address and repair estimate — DealMind AI handles everything else.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
                {error}
              </div>
            )}

            <DealInputForm onSubmit={handleAnalyze} onRehabScan={setPendingRehabScan} onPhotosReady={setSessionPhotos} loading={loading} />
          </div>
        )}

        {/* ── Result: full analysis ── */}
        {view === 'result' && result && (
          <AnalysisDashboard result={result} sessionPhotos={sessionPhotos} onReset={() => setView('home')} />
        )}

      </div>
    </main>
  )
}
