'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DealInput } from '@/types/deal'
import { DEFAULTS } from '@/lib/utils/constants'
import AddressAutocomplete from './AddressAutocomplete'

interface Props {
  onSubmit: (data: DealInput) => void
  onRehabScan?: (scan: any) => void
  onPhotosReady?: (photos: string[]) => void
  loading: boolean
}

interface PropertyData {
  beds: number; baths: number; sqft: number; yearBuilt: number
  propertyType: string; units?: number; lastSalePrice?: number
  rentAvg?: number; arvEstimate?: number
}

interface MortgageData {
  lenderName?: string
  loanBalance?: number
  monthlyPITI?: number
  interestRate?: number
  remainingMonths?: number
  confidence?: string
  notes?: string
}

export default function DealInputForm({ onSubmit, onRehabScan, onPhotosReady, loading }: Props) {
  const [step, setStep]                     = useState<'address' | 'photos'>('address')
  const [lookingUp, setLookingUp]           = useState(false)
  const [lookupError, setLookupError]       = useState<string | null>(null)
  const [propertyData, setPropertyData]     = useState<PropertyData | null>(null)
  const [showEditDetails, setShowEditDetails] = useState(false)

  // Property photos
  const [photos, setPhotos]               = useState<File[]>([])
  const [dragging, setDragging]           = useState(false)
  const [analyzingPhotos, setAnalyzingPhotos] = useState(false)
  const [photoScanDone, setPhotoScanDone] = useState(false)
  const [rehabEstimate, setRehabEstimate] = useState<number | null>(null)
  const [rehabRental, setRehabRental]     = useState<number | null>(null)
  const [rehabFlip, setRehabFlip]         = useState<number | null>(null)
  const [rehabSummary, setRehabSummary]   = useState<string>('')
  const [scanError, setScanError]         = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Mortgage statement
  const [mortgageFile, setMortgageFile]           = useState<File | null>(null)
  const [analyzingMortgage, setAnalyzingMortgage] = useState(false)
  const [mortgageData, setMortgageData]           = useState<MortgageData | null>(null)
  const [mortgageDragging, setMortgageDragging]   = useState(false)
  const [editingMortgage, setEditingMortgage]     = useState(false)
  const mortgageInputRef = useRef<HTMLInputElement>(null)

  // Known issues / repair details
  const [repairItems, setRepairItems] = useState<{ id: string; description: string; cost: string; photos: File[] }[]>([])
  const [repairNotes, setRepairNotes] = useState('')
  const repairPhotoInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Submit control — wait for both scans
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleFormSubmit(data: DealInput) {
    const issuesWithPhotos = await Promise.all(
      repairItems
        .filter(item => item.description.trim())
        .map(async item => ({
          description: item.description.trim(),
          estimatedCost: parseFloat(item.cost) || 0,
          photos: item.photos.length > 0
            ? await Promise.all(item.photos.slice(0, 5).map(compressPhoto))
            : undefined,
        }))
    )
    onSubmit({
      ...data,
      repairNotes: repairNotes.trim() || undefined,
      knownIssues: issuesWithPhotos.length > 0 ? issuesWithPhotos : undefined,
    })
  }

  const { register, handleSubmit, watch, setValue, getValues } = useForm<DealInput>({
    defaultValues: {
      propertyType: 'single-family', bedrooms: 3, bathrooms: 2,
      sqft: 1500, yearBuilt: 1990, units: 1,
      estimatedARV: 0, estimatedRepairs: 0, askingPrice: 0, assignmentFee: 0,
      downPaymentPct: DEFAULTS.DOWN_PAYMENT_PCT, interestRate: DEFAULTS.INTEREST_RATE,
      loanTermMonths: DEFAULTS.LOAN_TERM_MONTHS, vacancyRate: DEFAULTS.VACANCY_RATE,
      mgmtFeePct: DEFAULTS.MGMT_FEE_PCT, annualTaxes: 4000, annualInsurance: 1800,
      maintenanceReservePct: DEFAULTS.MAINTENANCE_RESERVE_PCT,
      annualAppreciation: DEFAULTS.ANNUAL_APPRECIATION, marketCapRate: DEFAULTS.MARKET_CAP_RATE,
      strOccupancy: 0.65, platformFeePct: DEFAULTS.AIRBNB_PLATFORM_FEE, furnishingCost: 15000,
    },
  })

  const propertyType = watch('propertyType')

  // Load company defaults and override form values
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => {
        if (s.defaultInterestRate)       setValue('interestRate',           s.defaultInterestRate)
        if (s.defaultDownPaymentPct)     setValue('downPaymentPct',         s.defaultDownPaymentPct)
        if (s.defaultLoanTermMonths)     setValue('loanTermMonths',         s.defaultLoanTermMonths)
        if (s.defaultVacancyRate)        setValue('vacancyRate',            s.defaultVacancyRate)
        if (s.defaultMgmtFeePct)         setValue('mgmtFeePct',             s.defaultMgmtFeePct)
        if (s.defaultMaintenancePct)     setValue('maintenanceReservePct',  s.defaultMaintenancePct)
        if (s.defaultAnnualAppreciation) setValue('annualAppreciation',     s.defaultAnnualAppreciation)
        if (s.defaultMarketCapRate)      setValue('marketCapRate',          s.defaultMarketCapRate)
        if (s.defaultEMD)                setValue('emd',                    s.defaultEMD)
        if (s.defaultHardMoneyRate)      setValue('hardMoneyRate',          s.defaultHardMoneyRate)
        if (s.defaultHardMoneyPoints)    setValue('hardMoneyPoints',        s.defaultHardMoneyPoints)
        if (s.defaultHardMoneyTermMonths) setValue('hardMoneyTermMonths',   s.defaultHardMoneyTermMonths)
      })
      .catch(() => { /* keep hardcoded defaults on failure */ })
  }, [setValue])

  // Submit when all pending scans are done
  useEffect(() => {
    if (pendingSubmit && !analyzingMortgage) {
      setPendingSubmit(false)
      formRef.current?.requestSubmit()
    }
  }, [pendingSubmit, analyzingMortgage])

  // No auto-scan — user clicks "Analyze Photos" when all uploads are done

  // ── Property photo handlers ──────────────────────────────────────────────
  function addPhotoFiles(files: FileList | null) {
    if (!files) return
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'))
    setPhotos(prev => [...prev, ...imgs].slice(0, 30))
    setPhotoScanDone(false)
    setRehabEstimate(null)
    setRehabRental(null)
    setRehabFlip(null)
    setRehabSummary('')
    setScanError(null)
  }

  function handlePhotoDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false); addPhotoFiles(e.dataTransfer.files)
  }

  // Compress a File to a small Blob suitable for Claude vision (~200-400 KB each)
  async function compressForScan(file: File): Promise<Blob> {
    return new Promise(resolve => {
      const img = document.createElement('img')
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 1280 // good resolution for Claude to assess condition
        const scale  = Math.min(1, maxDim / Math.max(img.width, img.height))
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        canvas.toBlob(blob => resolve(blob ?? new Blob()), 'image/jpeg', 0.80)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(new Blob()) }
      img.src = url
    })
  }

  async function runPhotoScan(files: File[]) {
    setAnalyzingPhotos(true)
    setScanError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000) // 2 min max
    try {
      // Compress before sending — raw phone photos can be 5-10 MB each
      const toSend = files.slice(0, 20) // 20 is plenty for full assessment
      const blobs  = await Promise.all(toSend.map(compressForScan))

      const fd = new FormData()
      blobs.forEach((blob, i) => fd.append('photos', blob, `photo_${i}.jpg`))

      const res  = await fetch('/api/analyze-photos', { method: 'POST', body: fd, signal: controller.signal })
      const data = await res.json()

      if (data.error) {
        setScanError(data.error + (data.raw ? ` — ${data.raw.slice(0, 120)}` : ''))
        console.error('Photo scan error:', data.error, data.raw)
      }
      const rental = data.rentalRehab ?? null
      const flip   = data.fullFixFlip ?? data.totalEstimate ?? null
      if (rental !== null) setRehabRental(rental)
      if (flip !== null)   setRehabFlip(flip)
      // Default: pre-select rental rehab as the repair budget (conservative)
      const defaultEstimate = rental ?? flip
      if (defaultEstimate) {
        setRehabEstimate(defaultEstimate)
        setValue('estimatedRepairs', defaultEstimate)
      }
      if (data.summary) setRehabSummary(data.summary)
      if (!data.error) onRehabScan?.(data)
    } catch (err: any) {
      const msg = err?.name === 'AbortError'
        ? 'Photo analysis timed out (2 min). Try fewer photos or click Analyze again.'
        : (err?.message ?? 'Network error sending photos')
      setScanError(msg)
      console.error('Photo scan failed:', err)
    } finally {
      clearTimeout(timeout)
      setAnalyzingPhotos(false)
      setPhotoScanDone(true)
    }
  }

  // ── Mortgage statement handlers ──────────────────────────────────────────
  function handleMortgageDrop(e: React.DragEvent) {
    e.preventDefault(); setMortgageDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processMortgageFile(file)
  }

  async function processMortgageFile(file: File) {
    setMortgageFile(file)
    setMortgageData(null)
    setEditingMortgage(false)
    setAnalyzingMortgage(true)
    try {
      const fd = new FormData()
      fd.append('statement', file)
      const res = await fetch('/api/analyze-mortgage', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.error) {
        setMortgageData(data)
        if (data.loanBalance)     setValue('existingLoanBalance', data.loanBalance)
        if (data.monthlyPITI)     setValue('existingMonthlyPITI', data.monthlyPITI)
        if (data.interestRate)    setValue('existingInterestRate', data.interestRate)
        if (data.remainingMonths) setValue('existingRemainingMonths', data.remainingMonths)
      }
    } catch {
      setMortgageData({ notes: 'Could not read statement — enter details manually below' })
      setEditingMortgage(true)
    } finally {
      setAnalyzingMortgage(false)
    }
  }

  // ── Address selected ─────────────────────────────────────────────────────
  async function handleAddressSelect(parsed: { fullAddress?: string; street: string; city: string; state: string; zip: string; lat?: number; lng?: number }) {
    // If Google Places didn't parse components, extract from full address string
    let { street, city, state, zip } = parsed
    if ((!street || !zip) && parsed.fullAddress) {
      const m = parsed.fullAddress.match(/^(.+?),\s*(.+?),\s*([A-Za-z]{2}),?\s*(\d{5})?/)
      if (m) { street = m[1].trim(); city = m[2].trim(); state = m[3].toUpperCase().trim(); zip = m[4]?.trim() ?? '' }
    }
    setValue('address', street); setValue('city', city)
    setValue('state', state);    setValue('zip', zip)
    if (parsed.lat) setValue('lat', parsed.lat)
    if (parsed.lng) setValue('lng', parsed.lng)
    if (!street && !city && !zip) { setLookupError('Could not parse address — please try again'); return }

    setLookingUp(true); setLookupError(null); setPropertyData(null)
    try {
      const params = new URLSearchParams({ address: street, city, state, zip })
      const res = await fetch(`/api/property-lookup?${params}`)
      const data = await res.json()
      const prop = data.property
      const rentAvg = data.rentComps?.rentAvg ?? 0
      const arvEstimate = data.saleComps?.priceAvg ?? 0

      setValue('bedrooms',     prop?.bedrooms     || 3)
      setValue('bathrooms',    prop?.bathrooms     || 2)
      setValue('sqft',         prop?.sqft          || 1500)
      setValue('yearBuilt',    prop?.yearBuilt     || 1990)
      setValue('propertyType', data.propertyType   || 'single-family')
      if (prop?.units)      setValue('units', prop.units)
      if (arvEstimate > 0)  setValue('estimatedARV', arvEstimate)

      setPropertyData({
        beds: prop?.bedrooms ?? 0, baths: prop?.bathrooms ?? 0,
        sqft: prop?.sqft ?? 0,     yearBuilt: prop?.yearBuilt ?? 0,
        propertyType: data.propertyType ?? 'single-family',
        units: prop?.units, lastSalePrice: prop?.lastSalePrice,
        rentAvg, arvEstimate,
      })
      if (data.error) setLookupError('RentCast lookup limited — review details below')
    } catch {
      setLookupError('Could not pull property data — you can still proceed')
    } finally {
      setLookingUp(false); setStep('photos')
    }
  }

  async function compressPhoto(file: File): Promise<string> {
    return new Promise(resolve => {
      const img = document.createElement('img')
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxW = 800
        const scale = Math.min(1, maxW / img.width)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.65))
      }
      img.src = url
    })
  }

  useEffect(() => {
    if (!photoScanDone || photos.length === 0 || !onPhotosReady) return
    Promise.all(photos.slice(0, 30).map(compressPhoto)).then(onPhotosReady)
  }, [photoScanDone]) // eslint-disable-line react-hooks/exhaustive-deps

  function doSubmit() {
    if (analyzingMortgage) { setPendingSubmit(true) }
    else { formRef.current?.requestSubmit() }
  }

  const statBg = 'bg-slate-800/60 rounded-xl p-3'

  return (
    <form ref={formRef} onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <input type="hidden" {...register('address')} />
      <input type="hidden" {...register('city')} />
      <input type="hidden" {...register('state')} />
      <input type="hidden" {...register('zip')} />
      <input type="hidden" {...register('lat', { valueAsNumber: true })} />
      <input type="hidden" {...register('lng', { valueAsNumber: true })} />

      {/* ── STEP 1: ADDRESS ── */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={`w-7 h-7 rounded-lg text-white text-sm flex items-center justify-center font-bold shrink-0 ${step === 'photos' ? 'bg-emerald-500' : ''}`}
            style={step === 'address' ? { background: 'linear-gradient(135deg, #00c8ff, #0066cc)' } : {}}>
            {step === 'photos' ? '✓' : '1'}
          </span>
          <div>
            <h3 className="text-base font-semibold text-white">Property Address</h3>
            <p className="text-xs text-slate-500">We pull all property data automatically</p>
          </div>
        </div>

        <AddressAutocomplete onSelect={handleAddressSelect} />

        {lookingUp && (
          <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
            <svg className="animate-spin h-4 w-4 shrink-0" style={{ color: '#00c8ff' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Pulling property data...
          </div>
        )}
        {lookupError && !lookingUp && (
          <p className="mt-3 text-xs text-yellow-400 flex items-center gap-2"><span>⚠</span>{lookupError}</p>
        )}

        {propertyData && !lookingUp && (
          <div className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Type',         value: propertyData.propertyType.replace(/-/g, ' ') },
                { label: 'Beds / Baths', value: `${propertyData.beds}bd / ${propertyData.baths}ba` },
                { label: 'Sqft',         value: propertyData.sqft > 0 ? propertyData.sqft.toLocaleString() : '—' },
                { label: 'Year Built',   value: propertyData.yearBuilt > 0 ? propertyData.yearBuilt : '—' },
                propertyData.rentAvg      ? { label: 'Market Rent', value: `$${propertyData.rentAvg.toLocaleString()}/mo` } : null,
                propertyData.arvEstimate  ? { label: 'Est. ARV',    value: `$${propertyData.arvEstimate.toLocaleString()}` } : null,
                propertyData.lastSalePrice ? { label: 'Last Sale', value: `$${propertyData.lastSalePrice.toLocaleString()}` } : null,
              ].filter(Boolean).map((item: any) => (
                <div key={item.label} className={statBg}>
                  <p className="text-xs text-slate-500 mb-0.5">{item.label}</p>
                  <p className="text-sm font-semibold text-white capitalize">{item.value}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowEditDetails(s => !s)}
              className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              {showEditDetails ? '▲ Hide' : '▼ Edit'} details
            </button>
            {showEditDetails && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-700/50">
                <div className="col-span-2 md:col-span-4">
                  <label className="label mb-2">Property Class</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {([
                      { value: 'single-family', label: 'Single Family', icon: '🏠', desc: 'SFR / condo / townhouse' },
                      { value: 'multi-family',  label: 'Multi-Family',  icon: '🏢', desc: '2–4 units or apartment' },
                      { value: 'commercial',    label: 'Commercial',    icon: '🏪', desc: 'Retail / office / industrial' },
                      { value: 'mobile-home',   label: 'Mobile / Trailer', icon: '🏡', desc: 'Mobile home / trailer' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setValue('propertyType', opt.value)}
                        className={`rounded-xl p-3 text-left border transition-all ${
                          propertyType === opt.value
                            ? 'border-cyan-500 bg-cyan-500/15'
                            : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-lg block mb-1">{opt.icon}</span>
                        <p className="text-xs font-semibold text-white">{opt.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  <input type="hidden" {...register('propertyType')} />
                </div>
                <div><label className="label">Beds</label>
                  <input type="number" {...register('bedrooms', { valueAsNumber: true })} className="input text-sm" /></div>
                <div><label className="label">Baths</label>
                  <input type="number" step="0.5" {...register('bathrooms', { valueAsNumber: true })} className="input text-sm" /></div>
                <div><label className="label">Sqft</label>
                  <input type="number" {...register('sqft', { valueAsNumber: true })} className="input text-sm" /></div>
                <div><label className="label">Year Built</label>
                  <input type="number" {...register('yearBuilt', { valueAsNumber: true })} className="input text-sm" /></div>
                {propertyType === 'multi-family' && (
                  <div><label className="label">Units</label>
                    <input type="number" {...register('units', { valueAsNumber: true })} className="input text-sm" min={2} /></div>
                )}
                {(propertyType === 'commercial') && (
                  <>
                    <div><label className="label">Annual NOI ($)</label>
                      <input type="number" {...register('commercialAnnualNOI', { valueAsNumber: true })} className="input text-sm" placeholder="e.g. 60000" /></div>
                    <div><label className="label">Tenants</label>
                      <input type="number" {...register('commercialTenantCount', { valueAsNumber: true })} className="input text-sm" placeholder="1" /></div>
                    <div><label className="label">Lease Type</label>
                      <select {...register('commercialLeaseType')} className="input text-sm">
                        <option value="nnn">Triple Net (NNN)</option>
                        <option value="gross">Gross Lease</option>
                        <option value="modified-gross">Modified Gross</option>
                      </select></div>
                  </>
                )}
                {(propertyType === 'mobile-home') && (
                  <>
                    <div className="col-span-2"><label className="label">Land Ownership</label>
                      <div className="flex gap-2 mt-1">
                        <button type="button" onClick={() => setValue('mobileHomeParkOwned', false)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${!watch('mobileHomeParkOwned') ? 'border-cyan-500 bg-cyan-500/15 text-white' : 'border-slate-700 text-slate-400'}`}>
                          Land Included
                        </button>
                        <button type="button" onClick={() => setValue('mobileHomeParkOwned', true)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${watch('mobileHomeParkOwned') ? 'border-cyan-500 bg-cyan-500/15 text-white' : 'border-slate-700 text-slate-400'}`}>
                          Park Owned (Lot Rent)
                        </button>
                      </div></div>
                    {watch('mobileHomeParkOwned') && (
                      <div><label className="label">Monthly Lot Rent ($)</label>
                        <input type="number" {...register('mobileHomeLotRent', { valueAsNumber: true })} className="input text-sm" placeholder="500" /></div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STEP 2: DATA GATHERING ── */}
      {step === 'photos' && (
        <div className="space-y-4">

          {/* ── Property Photos ── */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-lg text-white text-sm flex items-center justify-center font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #00c8ff, #0066cc)' }}>2</span>
              <div>
                <h3 className="text-base font-semibold text-white">Property Photos</h3>
                <p className="text-xs text-slate-500">AI analyzes photos to determine rehab estimate automatically</p>
              </div>
            </div>

            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { addPhotoFiles(e.target.files); e.target.value = '' }} />

            {photos.length === 0 && !analyzingPhotos && (
              <div
                onClick={() => photoInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handlePhotoDrop}
                className={`w-full border-2 border-dashed rounded-xl py-10 text-center cursor-pointer transition-all select-none ${
                  dragging ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]' : 'border-slate-600 hover:border-cyan-500/50 hover:bg-slate-800/40'
                }`}
              >
                <div className="text-4xl mb-3">{dragging ? '📂' : '📷'}</div>
                <p className="text-slate-300 text-sm font-medium">{dragging ? 'Drop photos here' : 'Drag & drop photos or click to browse'}</p>
                <p className="text-slate-600 text-xs mt-1">JPG, PNG, WEBP · Up to 30 photos · AI determines rehab cost from images</p>
              </div>
            )}

            {photos.length > 0 && (
              <div className={`border-2 border-dashed rounded-xl p-3 transition-all ${dragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700/50'}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handlePhotoDrop}>
                <div className="flex flex-wrap gap-2 mb-2">
                  {photos.map((f, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-600 group">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      {!analyzingPhotos && (
                        <button type="button" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-lg">✕</button>
                      )}
                    </div>
                  ))}
                  {photos.length < 30 && !analyzingPhotos && (
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border border-slate-600 border-dashed flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 hover:border-cyan-500/50 transition-colors gap-1">
                      <span className="text-lg">+</span><span className="text-xs">Add</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500">{photos.length}/30 photos{!analyzingPhotos && !photoScanDone ? ' · add more or click Analyze when ready' : ''}</p>
              </div>
            )}

            {/* Analyze button — shown after photos are added, before scan starts */}
            {photos.length > 0 && !analyzingPhotos && !photoScanDone && (
              <button
                type="button"
                onClick={() => runPhotoScan(photos)}
                className="mt-3 w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg,#00c8ff,#0066cc)', color: '#fff' }}
              >
                🔍 Analyze {photos.length} Photo{photos.length !== 1 ? 's' : ''} for Rehab Estimate
              </button>
            )}

            {/* AI scanning progress */}
            {analyzingPhotos && (
              <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <svg className="animate-spin h-5 w-5 shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-cyan-300">AI analyzing {photos.length} photo{photos.length !== 1 ? 's' : ''}...</p>
                  <p className="text-xs text-slate-500">Determining rehab costs from property images</p>
                </div>
              </div>
            )}

            {/* Rehab result */}
            {photoScanDone && (rehabRental !== null || rehabFlip !== null) && (
              <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 overflow-hidden">
                <div className="px-4 pt-3 pb-2">
                  <p className="text-sm font-semibold text-emerald-400 mb-0.5">AI Rehab Estimates</p>
                  {rehabSummary && <p className="text-xs text-slate-400 max-w-sm">{rehabSummary}</p>}
                </div>
                <div className="grid grid-cols-2 gap-px bg-slate-700/40">
                  {rehabRental !== null && (
                    <button
                      type="button"
                      onClick={() => { setRehabEstimate(rehabRental); setValue('estimatedRepairs', rehabRental) }}
                      className={`px-4 py-3 text-left transition-colors ${rehabEstimate === rehabRental ? 'bg-blue-500/20 border-t-2 border-t-blue-400' : 'bg-slate-800/40 hover:bg-slate-700/40'}`}
                    >
                      <p className="text-xs text-blue-300 font-semibold mb-0.5">Rental Rehab</p>
                      <p className="text-xl font-extrabold text-white">${rehabRental.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Rent-ready · cosmetic scope</p>
                    </button>
                  )}
                  {rehabFlip !== null && (
                    <button
                      type="button"
                      onClick={() => { setRehabEstimate(rehabFlip!); setValue('estimatedRepairs', rehabFlip!) }}
                      className={`px-4 py-3 text-left transition-colors ${rehabEstimate === rehabFlip ? 'bg-orange-500/20 border-t-2 border-t-orange-400' : 'bg-slate-800/40 hover:bg-slate-700/40'}`}
                    >
                      <p className="text-xs text-orange-300 font-semibold mb-0.5">Full Fix &amp; Flip</p>
                      <p className="text-xl font-extrabold text-white">${rehabFlip.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Retail-ready · full renovation</p>
                    </button>
                  )}
                </div>
                <p className="px-4 py-2 text-xs text-slate-500">
                  {rehabEstimate !== null ? <>Using <span className="text-white font-semibold">${rehabEstimate.toLocaleString()}</span> as repair budget — click above to switch</> : 'Select a scope above'}
                </p>
              </div>
            )}
            {photoScanDone && rehabEstimate === null && (
              <div className="mt-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-400 font-semibold">Could not generate rehab estimate</p>
                {scanError
                  ? <p className="text-xs text-red-300 mt-1 break-all">{scanError}</p>
                  : <p className="text-xs text-slate-400 mt-0.5">No estimate returned — enter a repair cost manually below.</p>
                }
                <button type="button" onClick={() => { setPhotoScanDone(false); setScanError(null) }}
                  className="mt-2 text-xs text-cyan-400 underline hover:text-cyan-300">
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* ── Mortgage Statement ── */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-lg shrink-0"
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)' }}>📄</div>
              <div>
                <h3 className="text-base font-semibold text-white">Mortgage Statement <span className="text-xs font-normal text-slate-500 ml-1">Subject-To deals</span></h3>
                <p className="text-xs text-slate-500">Upload seller's mortgage statement — AI extracts all loan details automatically</p>
              </div>
            </div>

            <input ref={mortgageInputRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processMortgageFile(f); e.target.value = '' }} />

            {!mortgageFile && !analyzingMortgage && !mortgageData && (
              <div className="space-y-2">
                <div
                  onClick={() => mortgageInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setMortgageDragging(true) }}
                  onDragLeave={() => setMortgageDragging(false)}
                  onDrop={handleMortgageDrop}
                  className={`w-full border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-all select-none ${
                    mortgageDragging ? 'border-purple-400 bg-purple-500/10 scale-[1.01]' : 'border-slate-600 hover:border-purple-500/50 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="text-3xl mb-2">{mortgageDragging ? '📂' : '📋'}</div>
                  <p className="text-slate-300 text-sm font-medium">Drop mortgage statement here or click to upload</p>
                  <p className="text-slate-600 text-xs mt-1">PDF or image · AI reads loan balance, rate, payment, remaining term</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setMortgageData({}); setEditingMortgage(true) }}
                  className="w-full text-xs text-purple-400 hover:text-purple-300 transition-colors py-1"
                >
                  ✎ Enter mortgage info manually instead
                </button>
              </div>
            )}

            {analyzingMortgage && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <svg className="animate-spin h-5 w-5 shrink-0 text-purple-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-purple-300">Reading mortgage statement...</p>
                  <p className="text-xs text-slate-500">Extracting loan balance, rate, and payment details</p>
                </div>
              </div>
            )}

            {mortgageData && !analyzingMortgage && (
              <div>
                {/* Extracted data summary */}
                {!editingMortgage ? (
                  <div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {mortgageData.lenderName && (
                        <div className={`${statBg} col-span-2`}>
                          <p className="text-xs text-slate-500 mb-0.5">Lender</p>
                          <p className="text-sm font-semibold text-white">{mortgageData.lenderName}</p>
                        </div>
                      )}
                      {mortgageData.loanBalance != null && (
                        <div className={statBg}>
                          <p className="text-xs text-slate-500 mb-0.5">Loan Balance</p>
                          <p className="text-sm font-bold text-white">${mortgageData.loanBalance.toLocaleString()}</p>
                        </div>
                      )}
                      {mortgageData.monthlyPITI != null && (
                        <div className={statBg}>
                          <p className="text-xs text-slate-500 mb-0.5">Monthly PITI</p>
                          <p className="text-sm font-bold text-white">${mortgageData.monthlyPITI.toLocaleString()}</p>
                        </div>
                      )}
                      {mortgageData.interestRate != null && (
                        <div className={statBg}>
                          <p className="text-xs text-slate-500 mb-0.5">Interest Rate</p>
                          <p className="text-sm font-bold text-white">{(mortgageData.interestRate * 100).toFixed(2)}%</p>
                        </div>
                      )}
                      {mortgageData.remainingMonths != null && (
                        <div className={statBg}>
                          <p className="text-xs text-slate-500 mb-0.5">Months Left</p>
                          <p className="text-sm font-bold text-white">{mortgageData.remainingMonths} <span className="text-slate-500 font-normal text-xs">({Math.round(mortgageData.remainingMonths / 12)} yrs)</span></p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${mortgageData.confidence === 'high' ? 'bg-emerald-400' : mortgageData.confidence === 'medium' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                        <span className="text-xs text-slate-500">{mortgageData.confidence ?? 'unknown'} confidence</span>
                      </div>
                      <button type="button" onClick={() => setEditingMortgage(true)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">✎ Edit</button>
                      <button type="button" onClick={() => { setMortgageFile(null); setMortgageData(null) }}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors">Remove</button>
                    </div>
                  </div>
                ) : (
                  /* Editable fields */
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div><label className="label">Loan Balance ($)</label>
                        <input type="number" {...register('existingLoanBalance', { valueAsNumber: true })} className="input text-sm" placeholder="185000" /></div>
                      <div><label className="label">Monthly PITI ($)</label>
                        <input type="number" {...register('existingMonthlyPITI', { valueAsNumber: true })} className="input text-sm" placeholder="1450" /></div>
                      <div><label className="label">Interest Rate (%)</label>
                        <input type="number" step="0.01"
                          onChange={e => setValue('existingInterestRate', parseFloat(e.target.value) / 100)}
                          defaultValue={mortgageData?.interestRate ? +(mortgageData.interestRate * 100).toFixed(3) : undefined}
                          className="input text-sm" placeholder="3.5" /></div>
                      <div><label className="label">Months Remaining</label>
                        <input type="number" {...register('existingRemainingMonths', { valueAsNumber: true })} className="input text-sm" placeholder="312" /></div>
                    </div>
                    <button type="button" onClick={() => setEditingMortgage(false)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">✓ Done</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Known Issues / Repair Details ── */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-lg shrink-0"
                style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>🔧</div>
              <div>
                <h3 className="text-base font-semibold text-white">Known Issues &amp; Repair Details <span className="text-xs font-normal text-slate-500 ml-1">optional</span></h3>
                <p className="text-xs text-slate-500">Document specific repairs — upload issue photos and describe what needs to be done</p>
              </div>
            </div>

            <div className="space-y-3">
              {repairItems.map((item, i) => (
                <div key={item.id} className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-xs flex items-center justify-center shrink-0 mt-2 font-semibold">{i + 1}</span>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => setRepairItems(prev => prev.map((r, j) => j === i ? { ...r, description: e.target.value } : r))}
                      className="input flex-1 text-sm"
                      placeholder="e.g. Roof needs full replacement — active leak in master bedroom"
                    />
                    <input
                      type="number"
                      value={item.cost}
                      onChange={e => setRepairItems(prev => prev.map((r, j) => j === i ? { ...r, cost: e.target.value } : r))}
                      className="input w-28 text-sm"
                      placeholder="$ Cost"
                    />
                    <button type="button" onClick={() => setRepairItems(prev => prev.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-red-400 transition-colors text-lg leading-none mt-1.5 shrink-0">✕</button>
                  </div>
                  {/* Issue photos */}
                  <div className="flex items-center gap-2 ml-7">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      ref={el => { repairPhotoInputRefs.current[i] = el }}
                      onChange={e => {
                        const files = Array.from(e.target.files ?? [])
                        if (!files.length) return
                        setRepairItems(prev => prev.map((r, j) => j === i ? { ...r, photos: [...r.photos, ...files].slice(0, 5) } : r))
                        e.target.value = ''
                      }}
                    />
                    {item.photos.map((f, pi) => (
                      <div key={pi} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-600 group shrink-0">
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        <button type="button"
                          onClick={() => setRepairItems(prev => prev.map((r, j) => j === i ? { ...r, photos: r.photos.filter((_, k) => k !== pi) } : r))}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm">✕</button>
                      </div>
                    ))}
                    {item.photos.length < 5 && (
                      <button type="button"
                        onClick={() => repairPhotoInputRefs.current[i]?.click()}
                        className="w-14 h-14 rounded-lg border border-slate-600 border-dashed flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 hover:border-orange-500/50 transition-colors gap-0.5 shrink-0">
                        <span className="text-base">📷</span>
                        <span className="text-xs">Photo</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button"
              onClick={() => setRepairItems(prev => [...prev, { id: Math.random().toString(36).slice(2), description: '', cost: '', photos: [] }])}
              className="mt-3 w-full py-2 rounded-xl border border-dashed border-orange-500/30 text-orange-400 hover:border-orange-500/60 hover:bg-orange-500/5 transition-all text-sm font-medium">
              + Add Repair Item
            </button>

            <div className="mt-3">
              <label className="label">General Notes <span className="text-slate-500 font-normal text-xs ml-1">seller-disclosed issues, inspection findings, etc.</span></label>
              <textarea
                value={repairNotes}
                onChange={e => setRepairNotes(e.target.value)}
                className="input w-full text-sm resize-none"
                rows={3}
                placeholder="e.g. Seller disclosed foundation crack on east wall, AC is original 2001 unit, kitchen was gutted and never finished..."
              />
            </div>
          </div>

          {/* ── Deal Info + Analyze ── */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 h-7 rounded-lg text-white text-sm flex items-center justify-center font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #00c8ff, #0066cc)' }}>3</span>
              <div>
                <h3 className="text-base font-semibold text-white">Ready to Analyze</h3>
                <p className="text-xs text-slate-500">Add optional deal info then run the analysis</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Seller Asking Price ($) <span className="text-slate-500 font-normal text-xs ml-1">optional</span></label>
                <input type="number" {...register('askingPrice', { valueAsNumber: true })}
                  className="input" placeholder="Leave blank to run at MAO" />
              </div>
              <div>
                <label className="label">
                  Your Assignment Fee ($)
                  <span className="text-slate-500 font-normal text-xs ml-1">your profit</span>
                </label>
                <input type="number" {...register('assignmentFee', { valueAsNumber: true })}
                  className="input" placeholder="e.g. 10000" />
                <p className="text-xs text-slate-500 mt-1">Added to contract price → shown as investor's purchase price on the report</p>
              </div>
            </div>

            <button type="button" disabled={loading || analyzingPhotos || analyzingMortgage} onClick={doSubmit}
              className="btn-primary w-full py-4 text-base font-semibold">
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analyzing with DealMind AI...
                </span>
              ) : analyzingPhotos ? 'Waiting for photo scan...'
                : analyzingMortgage ? 'Reading mortgage statement...'
                : '🧠 Analyze Deal'}
            </button>

            {photos.length === 0 && !photoScanDone && (
              <p className="text-center text-xs text-slate-500">
                No photos uploaded — rehab estimate will be $0.{' '}
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">Add photos</button>
              </p>
            )}
          </div>

        </div>
      )}
    </form>
  )
}
