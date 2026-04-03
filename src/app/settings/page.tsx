'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CompanySettings, DEFAULT_COMPANY } from '@/types/company'

type Tab = 'company' | 'team'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  createdAt: string
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company')
  const [form, setForm] = useState<CompanySettings>(DEFAULT_COMPANY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Current user
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null)

  // Team management
  const [team, setTeam] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'member' | 'admin'>('member')
  const [addingMember, setAddingMember] = useState(false)
  const [addError, setAddError] = useState('')
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ]).then(([settingsData, meData]) => {
      setForm(settingsData)
      if (settingsData.logoBase64) setPreview(settingsData.logoBase64)
      if (!meData.error) setCurrentUser(meData)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (tab === 'team' && currentUser?.role === 'admin') {
      loadTeam()
    }
  }, [tab, currentUser])

  async function loadTeam() {
    setTeamLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setTeam(await res.json())
    setTeamLoading(false)
  }

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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    setAddingMember(true)
    setAddError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAddError(data.error ?? 'Failed to add member')
    } else {
      setTeam(t => [...t, data])
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('member')
    }
    setAddingMember(false)
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this team member?')) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setTeam(t => t.filter(m => m.id !== id))
  }

  async function handleResetPassword(id: string) {
    if (!resetPassword.trim()) return
    setResetting(true)
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, newPassword: resetPassword }),
    })
    setResetting(false)
    setResetId(null)
    setResetPassword('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--navy-900)' }}>
        <p className="text-slate-400">Loading settings...</p>
      </div>
    )
  }

  const isAdmin = currentUser?.role === 'admin'

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy-900)' }}>
      <header className="border-b border-slate-700/40 sticky top-0 z-50"
        style={{ background: 'rgba(11, 15, 30, 0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="DealMind AI" width={160} height={52} className="rounded-lg object-contain" priority />
          </button>
          <div className="flex items-center gap-3">
            {currentUser && (
              <span className="text-sm text-slate-400 hidden sm:block">
                {currentUser.name}
                {isAdmin && <span className="ml-1.5 text-xs text-cyan-400 font-semibold">Admin</span>}
              </span>
            )}
            <button onClick={() => router.push('/')} className="btn-secondary text-sm">← Back</button>
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Sign Out</button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-700/40" style={{ background: 'rgba(11, 15, 30, 0.8)' }}>
        <div className="max-w-4xl mx-auto px-4 flex gap-1">
          {(['company', ...(isAdmin ? ['team'] : [])] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              {t === 'company' ? 'Company & Defaults' : 'Team Members'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Company Tab ── */}
        {tab === 'company' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-white">Company Branding & Settings</h2>
              <p className="text-slate-400 text-sm mt-1">This info appears on all investor reports sent to the dispositions team.</p>
            </div>

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

            <div className="flex items-center gap-4">
              <button type="submit" disabled={saving} className="btn-primary px-8 py-3">
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              {saved && <p className="text-sm text-emerald-400">✓ Settings saved</p>}
            </div>
          </form>
        )}

        {/* ── Team Tab (admin only) ── */}
        {tab === 'team' && isAdmin && (
          <div className="space-y-6">
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-white">Team Members</h2>
              <p className="text-slate-400 text-sm mt-1">Each member logs in with their own email and password and sees only their own deals.</p>
            </div>

            {/* Add member form */}
            <div className="card p-6">
              <h3 className="text-base font-semibold text-white mb-4">Add Team Member</h3>
              <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jane Smith" required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jane@example.com" required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Temporary password" required minLength={6} />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={newRole} onChange={e => setNewRole(e.target.value as 'member' | 'admin')}>
                    <option value="member">Member — sees own deals only</option>
                    <option value="admin">Admin — sees all deals</option>
                  </select>
                </div>
                {addError && <p className="md:col-span-2 text-sm text-red-400">{addError}</p>}
                <div className="md:col-span-2">
                  <button type="submit" disabled={addingMember} className="btn-primary px-6">
                    {addingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            </div>

            {/* Members list */}
            <div className="card p-6">
              <h3 className="text-base font-semibold text-white mb-4">Current Team</h3>
              {teamLoading ? (
                <p className="text-slate-400 text-sm">Loading...</p>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {team.map(member => (
                    <div key={member.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {member.name}
                          {member.id === currentUser?.id && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${member.role === 'admin' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-slate-700 text-slate-400'}`}>
                          {member.role}
                        </span>
                        {member.id !== currentUser?.id && (
                          <>
                            {resetId === member.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="password"
                                  placeholder="New password"
                                  value={resetPassword}
                                  onChange={e => setResetPassword(e.target.value)}
                                  className="w-32 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-cyan-500"
                                  minLength={6}
                                />
                                <button onClick={() => handleResetPassword(member.id)} disabled={resetting || !resetPassword}
                                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
                                  {resetting ? '...' : 'Save'}
                                </button>
                                <button onClick={() => { setResetId(null); setResetPassword('') }}
                                  className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => { setResetId(member.id); setResetPassword('') }}
                                  className="text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                                  Reset PW
                                </button>
                                <button onClick={() => handleRemove(member.id)}
                                  className="text-xs text-slate-400 hover:text-red-400 transition-colors">
                                  Remove
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
