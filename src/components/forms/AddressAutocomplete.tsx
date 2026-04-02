'use client'

import { useEffect, useRef, useState } from 'react'

interface ParsedAddress {
  fullAddress: string
  street: string
  city: string
  state: string
  zip: string
  lat?: number
  lng?: number
}

interface Props {
  onSelect: (addr: ParsedAddress) => void
  error?: boolean
}

interface Prediction {
  place_id: string
  description: string
  _raw?: { street: string; city: string; state: string; zip: string; lat?: string; lng?: string }
}

export default function AddressAutocomplete({ onSelect, error }: Props) {
  const [value, setValue]           = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [confirmed, setConfirmed]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // Fetch from Nominatim via our server route
  useEffect(() => {
    if (confirmed) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 4) {
      setPredictions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/places?input=${encodeURIComponent(value.trim())}`)
        const data = await res.json()
        const preds: Prediction[] = (data.predictions ?? []).map((p: any) => ({
          place_id:    p.place_id,
          description: p.description,
          _raw:        p._raw,
        }))
        setPredictions(preds)
        setOpen(preds.length > 0)
      } catch {
        setPredictions([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value, confirmed])

  function pickPrediction(pred: Prediction) {
    setOpen(false)
    setPredictions([])
    setValue(pred.description)
    setConfirmed(true)

    if (pred._raw?.street && pred._raw?.zip) {
      onSelectRef.current({
        fullAddress: pred.description,
        street:      pred._raw.street,
        city:        pred._raw.city,
        state:       pred._raw.state,
        zip:         pred._raw.zip,
        lat:         pred._raw.lat ? parseFloat(pred._raw.lat) : undefined,
        lng:         pred._raw.lng ? parseFloat(pred._raw.lng) : undefined,
      })
    } else {
      // Try parsing from the description string: "123 Main St, City, ST 12345"
      const m = pred.description.match(/^(.+?),\s*(.+?),\s*([A-Z]{2}),?\s+(\d{5})/)
      if (m) {
        onSelectRef.current({
          fullAddress: pred.description,
          street: m[1].trim(),
          city:   m[2].trim(),
          state:  m[3].trim(),
          zip:    m[4].trim(),
        })
      } else {
        onSelectRef.current({ fullAddress: pred.description, street: '', city: '', state: '', zip: '' })
      }
    }
  }

  async function useAsTyped() {
    setOpen(false)
    setPredictions([])
    const raw = value.trim()

    // 1. Try one more geocode lookup — Nominatim may return a result now
    try {
      const res  = await fetch(`/api/places?input=${encodeURIComponent(raw)}`)
      const data = await res.json()
      if (data.predictions?.length > 0) {
        const p = data.predictions[0]
        if (p._raw?.street && p._raw?.zip) {
          setConfirmed(true)
          setValue(p.description)
          onSelectRef.current({
            fullAddress: p.description,
            street: p._raw.street,
            city:   p._raw.city,
            state:  p._raw.state,
            zip:    p._raw.zip,
            lat:    p._raw.lat ? parseFloat(p._raw.lat) : undefined,
            lng:    p._raw.lng ? parseFloat(p._raw.lng) : undefined,
          })
          return
        }
      }
    } catch { /* fall through to manual parse */ }

    setConfirmed(true)

    // 2. Comma-separated: "123 Main St, City, TX 77573" (zip optional, case-insensitive)
    const commaM = raw.match(/^(.+?),\s*(.+?),\s*([A-Za-z]{2}),?\s*(\d{5})?/)
    if (commaM) {
      onSelectRef.current({
        fullAddress: raw,
        street: commaM[1].trim(),
        city:   commaM[2].trim(),
        state:  commaM[3].toUpperCase(),
        zip:    commaM[4]?.trim() ?? '',
      })
      return
    }

    // 3. Informal: "123 Main St City TX 77573" — detect state then parse around it
    const STATE_RE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i
    const stateM = raw.match(STATE_RE)
    if (stateM) {
      const stateIdx = raw.search(STATE_RE)
      const before   = raw.slice(0, stateIdx).trim().replace(/,\s*$/, '')
      const after    = raw.slice(stateIdx + stateM[0].length).trim()
      const zip      = after.match(/^(\d{5})/)?.[1] ?? ''

      // Split street from city using common street suffix
      const SUFFIX_RE = /\b(dr(?:ive)?|st(?:reet)?|ave(?:nue)?|blvd|boulevard|ln|lane|rd|road|way|ct|court|pl(?:ace)?|cir(?:cle)?|hwy|highway|pkwy|parkway|trl|trail|ter(?:race)?|loop|pass)\b/i
      const suffixM   = before.match(SUFFIX_RE)
      if (suffixM) {
        const cutIdx = before.search(SUFFIX_RE) + suffixM[0].length
        const street = before.slice(0, cutIdx).trim()
        const city   = before.slice(cutIdx).trim().replace(/^,\s*/, '')
        onSelectRef.current({ fullAddress: raw, street, city, state: stateM[0].toUpperCase(), zip })
        return
      }

      // Can't split street/city — pass what we have
      onSelectRef.current({ fullAddress: raw, street: before, city: '', state: stateM[0].toUpperCase(), zip })
      return
    }

    onSelectRef.current({ fullAddress: raw, street: '', city: '', state: '', zip: '' })
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setConfirmed(false) }}
          placeholder="123 Main St, Houston, TX 77001"
          className={`input pr-10 ${error ? 'ring-2 ring-red-500' : ''}`}
          autoComplete="off"
          spellCheck={false}
          onKeyDown={e => {
            if (e.key === 'Enter' && !open) { e.preventDefault(); useAsTyped() }
          }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : confirmed ? (
            <svg className="h-4 w-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>
      </div>

      {(open && predictions.length > 0) || (!loading && !confirmed && value.trim().length >= 8) ? (
        <ul
          className="absolute z-50 w-full mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: '#0f1628', border: '1px solid rgba(0,200,255,0.2)' }}
        >
          {predictions.map(pred => (
            <li
              key={pred.place_id}
              onMouseDown={() => pickPrediction(pred)}
              className="px-4 py-3 cursor-pointer text-sm text-white border-b border-slate-700/40 last:border-0 hover:bg-cyan-500/10 transition-colors"
            >
              <span className="mr-2 text-slate-500">📍</span>{pred.description}
            </li>
          ))}
          {/* Always show "use as typed" so user is never stuck */}
          {!confirmed && value.trim().length >= 8 && (
            <li
              onMouseDown={useAsTyped}
              className="px-4 py-2.5 cursor-pointer text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 transition-colors flex items-center gap-2 border-t border-slate-700/40"
            >
              <svg className="w-3.5 h-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              Use "<span className="text-slate-200 font-medium mx-1 truncate max-w-xs">{value.trim()}</span>" as typed
            </li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
