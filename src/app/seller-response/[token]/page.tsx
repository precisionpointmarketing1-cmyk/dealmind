'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface Record {
  token: string
  address: string
  offerAmt: number
  sellerName?: string
  createdAt: string
  status: 'pending' | 'accepted' | 'declined'
  respondedAt?: string
}

function cur(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function SellerResponsePage() {
  const { token } = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const [record, setRecord] = useState<Record | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')

  // Pre-selected intent from email link — shown as highlighted but NOT auto-submitted
  // (auto-submitting causes security scanners to incorrectly mark offers as declined)
  const intent = searchParams.get('action') as 'accepted' | 'declined' | null

  useEffect(() => {
    fetch(`/api/seller-response?token=${token}`)
      .then(r => r.json())
      .then(data => { setRecord(data); setLoading(false) })
      .catch(() => { setError('Offer not found or expired.'); setLoading(false) })
  }, [token])

  async function respond(action: 'accepted' | 'declined') {
    setActing(true)
    const res = await fetch(`/api/seller-response?token=${token}&action=${action}`, { method: 'PATCH' })
    if (res.ok) setRecord(r => r ? { ...r, status: action } : r)
    setActing(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-lg">Loading offer...</p>
    </div>
  )

  if (error || !record) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-800 mb-2">Offer Not Found</p>
        <p className="text-gray-500">{error || 'This offer link may have expired.'}</p>
      </div>
    </div>
  )

  const alreadyResponded = record.status !== 'pending'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-cyan-600 uppercase tracking-widest mb-1">Cash Offer</p>
          <h1 className="text-3xl font-bold text-gray-900">{record.address}</h1>
          {record.sellerName && <p className="text-gray-500 mt-1">Prepared for {record.sellerName}</p>}
        </div>

        {/* Offer amount card */}
        <div className="bg-gray-900 rounded-2xl p-8 text-center mb-6 shadow-xl">
          <p className="text-sm text-cyan-400 font-semibold uppercase tracking-widest mb-2">Your Cash Offer</p>
          <p className="text-6xl font-extrabold text-white mb-3">{record.offerAmt && !isNaN(record.offerAmt) ? cur(record.offerAmt) : '—'}</p>
          <p className="text-gray-400 text-sm">All-cash · As-is · No repairs · No agent fees</p>
        </div>

        {/* Response section */}
        {/* Intent banner — shown when arriving from email link */}
        {intent && !alreadyResponded && (
          <div className={`rounded-xl p-4 text-center mb-4 ${intent === 'accepted' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-semibold ${intent === 'accepted' ? 'text-emerald-700' : 'text-red-700'}`}>
              {intent === 'accepted' ? '👇 Click the green button below to confirm your acceptance' : '👇 Click the button below to confirm your decision'}
            </p>
          </div>
        )}

        {alreadyResponded ? (
          <div>
            <div className={`rounded-2xl p-8 text-center shadow-lg mb-4 ${record.status === 'accepted' ? 'bg-emerald-50 border-2 border-emerald-400' : 'bg-red-50 border-2 border-red-300'}`}>
              {record.status === 'accepted' ? (
                <>
                  <p className="text-5xl mb-3">✅</p>
                  <p className="text-2xl font-bold text-emerald-700 mb-2">Offer Accepted!</p>
                  <p className="text-emerald-600">We'll be in touch shortly to move forward. Thank you!</p>
                </>
              ) : (
                <>
                  <p className="text-5xl mb-3">❌</p>
                  <p className="text-2xl font-bold text-red-700 mb-2">Offer Declined</p>
                  <p className="text-red-600">Thank you for your response. Feel free to reach out if you change your mind.</p>
                </>
              )}
            </div>
            {/* Allow changing response */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
              <p className="text-gray-500 text-sm mb-3">Changed your mind?</p>
              <div className="flex gap-3">
                <button onClick={() => respond('accepted')} disabled={acting || record.status === 'accepted'}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                  ✓ Accept
                </button>
                <button onClick={() => respond('declined')} disabled={acting || record.status === 'declined'}
                  className="flex-1 bg-white hover:bg-gray-50 disabled:opacity-30 text-gray-600 font-semibold py-3 rounded-xl border-2 border-gray-200 transition-colors text-sm">
                  ✕ Decline
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <p className="text-center text-gray-700 font-semibold text-lg mb-6">Would you like to accept this offer?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => respond('accepted')}
                disabled={acting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xl py-5 rounded-xl transition-colors disabled:opacity-50"
              >
                {acting ? 'Processing...' : '✓ Yes, Accept This Offer'}
              </button>
              <button
                onClick={() => respond('declined')}
                disabled={acting}
                className="w-full bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-600 font-semibold text-base py-4 rounded-xl border-2 border-gray-200 transition-colors disabled:opacity-50"
              >
                {acting ? 'Processing...' : '✕ No, Decline'}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              Accepting this offer is not legally binding — our team will follow up to finalize.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
