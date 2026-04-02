'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CompanySettings, DEFAULT_COMPANY } from '@/types/company'

export default function SettingsPage() {
  const [form, setForm] = useState<CompanySettings>(DEFAULT_COMPANY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setForm(data)
        if (data.logoBase64) setPreview(data.logoBase64)
        setLoading(false)
      })
  }, [])

  function set(key: keyof CompanySettings, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const b64 = ev.target?.result as string
      setPreview(b64)
      setForm(f => ({ ...f, logoBase64: b64 }))
    }
    reader.readAsDataURL(file)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--navy-900)' }}>
        <p className="text-slate-400">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy-900)' }}>
      <header className="border-b border-slate-700/40 sticky top-0 z-50"
        style={{ background: 'rgba(11, 15, 30, 0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="DealMind AI" width={160} height={52} className="rounded-lg object-contain" priority />
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="btn-secondary text-sm">← Back</button>
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Company Branding & Settings</h2>
          <p className="text-slate-400 text-sm mt-1">This info appears on all investor reports sent to the dispositions team.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          {/* Logo Upload */}
          <div className="card p-6">
            <h3 className="text-base font-semibold text-white mb-4">Company Logo</h3>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden shrink-0"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                {preview ? (
                  <img src={preview} alt="Logo preview" className="w-full h-full object-contain p-2" />
                ) : (
                  <p className="text-xs text-slate-500 text-center px-2">No logo uploaded</p>
                )}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-sm mb-2">
                  Upload Logo
                </button>
                <p className="text-xs text-slate-500">PNG or JPG recommended. Will appear on all PDF reports.</p>
                {preview && (
                  <button type="button" onClick={() => { setPreview(''); set('logoBase64', '') }}
                    className="text-xs text-red-400 hover:text-red-300 mt-2 block">
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="card p-6">
            <h3 className="text-base font-semibold text-white mb-4">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Company Name</label>
                <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="House Buyers Texas" />
              </div>
              <div className="md:col-span-2">
                <label className="label">Tagline</label>
                <input className="input" value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Off-Market Investment Specialists" />
              </div>
              <div>
                <label className="label">Agent / Rep Name</label>
                <input className="input" value={form.agentName} onChange={e => set('agentName', e.target.value)} placeholder="John Smith" />
              </div>
              <div>
                <label className="label">License Number</label>
                <input className="input" value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="TX-123456" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-5555" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="deals@housebuyerstx.com" />
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.housebuyerstx.com" />
              </div>
              <div>
                <label className="label">Office Address</label>
                <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Houston" />
              </div>
              <div>
                <label className="label">State</label>
                <input className="input" value={form.state} onChange={e => set('state', e.target.value)} placeholder="TX" />
              </div>
            </div>
          </div>

          {/* Brand Colors */}
          <div className="card p-6">
            <h3 className="text-base font-semibold text-white mb-4">Brand Colors</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="label">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                    className="w-12 h-10 rounded-lg border border-slate-600 cursor-pointer bg-transparent" />
                  <input className="input flex-1" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)} placeholder="#00c8ff" />
                </div>
              </div>
              <div>
                <label className="label">Accent Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.accentColor} onChange={e => set('accentColor', e.target.value)}
                    className="w-12 h-10 rounded-lg border border-slate-600 cursor-pointer bg-transparent" />
                  <input className="input flex-1" value={form.accentColor} onChange={e => set('accentColor', e.target.value)} placeholder="#0066cc" />
                </div>
              </div>
            </div>
          </div>

          {/* Deal Defaults */}
          <div className="card p-6">
            <h3 className="text-base font-semibold text-white mb-1">Deal Assumption Defaults</h3>
            <p className="text-xs text-slate-500 mb-4">Pre-filled values on every new deal analysis. Override per-deal as needed.</p>

            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Earnest Money &amp; Closing</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">Earnest Money (EMD) $</label>
                  <input className="input" type="number" value={form.defaultEMD} onChange={e => setForm(f => ({ ...f, defaultEMD: Number(e.target.value) }))} placeholder="110" />
                </div>
                <div>
                  <label className="label">Closing Cost %</label>
                  <input className="input" type="number" step="0.1" value={(form.defaultClosingCostPct * 100).toFixed(1)} onChange={e => setForm(f => ({ ...f, defaultClosingCostPct: Number(e.target.value) / 100 }))} placeholder="2.5" />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Conventional Lending</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">Interest Rate %</label>
                  <input className="input" type="number" step="0.1" value={(form.defaultInterestRate * 100).toFixed(2)} onChange={e => setForm(f => ({ ...f, defaultInterestRate: Number(e.target.value) / 100 }))} placeholder="7.50" />
                </div>
                <div>
                  <label className="label">Down Payment %</label>
                  <input className="input" type="number" step="1" value={(form.defaultDownPaymentPct * 100).toFixed(0)} onChange={e => setForm(f => ({ ...f, defaultDownPaymentPct: Number(e.target.value) / 100 }))} placeholder="20" />
                </div>
                <div>
                  <label className="label">Loan Term (months)</label>
                  <input className="input" type="number" value={form.defaultLoanTermMonths} onChange={e => setForm(f => ({ ...f, defaultLoanTermMonths: Number(e.target.value) }))} placeholder="360" />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Hard Money / Private Money</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">Hard Money Rate %</label>
                  <input className="input" type="number" step="0.1" value={(form.defaultHardMoneyRate * 100).toFixed(1)} onChange={e => setForm(f => ({ ...f, defaultHardMoneyRate: Number(e.target.value) / 100 }))} placeholder="12.0" />
                </div>
                <div>
                  <label className="label">Points %</label>
                  <input className="input" type="number" step="0.25" value={form.defaultHardMoneyPoints.toFixed(2)} onChange={e => setForm(f => ({ ...f, defaultHardMoneyPoints: Number(e.target.value) }))} placeholder="2.50" />
                </div>
                <div>
                  <label className="label">Term (months)</label>
                  <input className="input" type="number" value={form.defaultHardMoneyTermMonths} onChange={e => setForm(f => ({ ...f, defaultHardMoneyTermMonths: Number(e.target.value) }))} placeholder="12" />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Operating Expenses</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">Vacancy Rate %</label>
                  <input className="input" type="number" step="0.5" value={(form.defaultVacancyRate * 100).toFixed(1)} onChange={e => setForm(f => ({ ...f, defaultVacancyRate: Number(e.target.value) / 100 }))} placeholder="8.0" />
                </div>
                <div>
                  <label className="label">Mgmt Fee %</label>
                  <input className="input" type="number" step="1" value={(form.defaultMgmtFeePct * 100).toFixed(0)} onChange={e => setForm(f => ({ ...f, defaultMgmtFeePct: Number(e.target.value) / 100 }))} placeholder="10" />
                </div>
                <div>
                  <label className="label">Maintenance Reserve %</label>
                  <input className="input" type="number" step="0.5" value={(form.defaultMaintenancePct * 100).toFixed(1)} onChange={e => setForm(f => ({ ...f, defaultMaintenancePct: Number(e.target.value) / 100 }))} placeholder="5.0" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Market Assumptions</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">Annual Appreciation %</label>
                  <input className="input" type="number" step="0.5" value={(form.defaultAnnualAppreciation * 100).toFixed(1)} onChange={e => setForm(f => ({ ...f, defaultAnnualAppreciation: Number(e.target.value) / 100 }))} placeholder="4.0" />
                </div>
                <div>
                  <label className="label">Market Cap Rate %</label>
                  <input className="input" type="number" step="0.25" value={(form.defaultMarketCapRate * 100).toFixed(2)} onChange={e => setForm(f => ({ ...f, defaultMarketCapRate: Number(e.target.value) / 100 }))} placeholder="7.0" />
                </div>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="card p-6">
            <h3 className="text-base font-semibold text-white mb-2">Team Password</h3>
            <p className="text-sm text-slate-500 mb-3">To change the password, edit <code className="text-cyan-400">ADMIN_PASSWORD</code> in the <code className="text-cyan-400">.env.local</code> file and restart the server.</p>
            <p className="text-xs text-slate-600">Current password is set in your environment configuration.</p>
          </div>

          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving} className="btn-primary px-8 py-3">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && <p className="text-sm text-emerald-400">✓ Settings saved</p>}
          </div>
        </form>
      </div>
    </div>
  )
}
