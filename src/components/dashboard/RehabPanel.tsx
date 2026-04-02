'use client'

import { useEffect, useRef, useState } from 'react'
import { RehabScan } from '@/types/deal'

interface AddedItem {
  id: string
  description: string
  cost: number
}

interface SuggestedItem {
  description: string
  low: number
  mid: number
  high: number
  notes: string
  added?: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  suggestions?: SuggestedItem[]
}

interface Props {
  rehabScan?: RehabScan
  baseRepairs: number
  addedItems: AddedItem[]
  onRepairsChange: (amount: number) => void
  onItemsChange: (items: AddedItem[]) => void
}

const CONDITION_COLOR: Record<string, string> = {
  good: 'text-emerald-400',
  fair: 'text-yellow-400',
  poor: 'text-red-400',
}

export default function RehabPanel({ rehabScan, baseRepairs, addedItems, onRepairsChange, onItemsChange }: Props) {
  const hasAI = !!(rehabScan && (rehabScan.rentalRehab > 0 || rehabScan.fullFixFlip > 0))

  const [mode, setMode] = useState<'rental' | 'flip' | 'manual'>(hasAI ? 'rental' : 'manual')
  const [manualAmount, setManualAmount] = useState(String(baseRepairs || ''))
  const [showCategories, setShowCategories] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // addedItems is lifted to parent — controlled via props
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const aiRental = rehabScan?.rentalRehab ?? 0
  const aiFlip   = rehabScan?.fullFixFlip ?? 0

  const addedTotal = addedItems.reduce((s, i) => s + i.cost, 0)
  const baseAmount =
    mode === 'rental' ? aiRental :
    mode === 'flip'   ? aiFlip   :
    parseFloat(manualAmount) || 0
  const total = baseAmount + addedTotal

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // Compute total from given state and notify parent immediately
  function computeAndNotify(
    nextMode: typeof mode,
    nextManual: string,
    nextItems: AddedItem[]
  ) {
    const base =
      nextMode === 'rental' ? aiRental :
      nextMode === 'flip'   ? aiFlip   :
      parseFloat(nextManual) || 0
    const added = nextItems.reduce((s, i) => s + i.cost, 0)
    onRepairsChange(base + added)
  }

  function selectMode(m: 'rental' | 'flip' | 'manual') {
    setMode(m)
    computeAndNotify(m, manualAmount, addedItems)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)

    try {
      const res = await fetch('/api/repair-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          existingItems: addedItems.map(i => ({ description: i.description, cost: i.cost })),
        }),
      })
      const data = await res.json()

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        suggestions: data.items?.length > 0 ? data.items.map((item: SuggestedItem) => ({ ...item, added: false })) : undefined,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, could not get an estimate. Try again.' }])
    } finally {
      setSending(false)
    }
  }

  function addSuggestion(msgIdx: number, itemIdx: number, cost: 'low' | 'mid' | 'high') {
    const msg = messages[msgIdx]
    const item = msg.suggestions?.[itemIdx]
    if (!item) return

    const newItem: AddedItem = {
      id: Math.random().toString(36).slice(2),
      description: item.description,
      cost: item[cost],
    }
    const nextItems = [...addedItems, newItem]
    onItemsChange(nextItems)
    computeAndNotify(mode, manualAmount, nextItems)

    // Mark as added in the message
    setMessages(prev => prev.map((m, mi) =>
      mi !== msgIdx ? m : {
        ...m,
        suggestions: m.suggestions?.map((s, si) => si === itemIdx ? { ...s, added: true } : s),
      }
    ))
  }

  function removeAddedItem(id: string) {
    const nextItems = addedItems.filter(i => i.id !== id)
    onItemsChange(nextItems)
    computeAndNotify(mode, manualAmount, nextItems)
  }

  const categories = rehabScan?.categories ?? []
  const activeCategories = categories.filter(c => mode === 'rental' ? c.estimateLow > 0 : c.estimateHigh > 0)

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Rehab Budget</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasAI ? 'AI estimates from photo scan — toggle scope or chat to add items' : 'Chat with AI to build your repair list'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Active Budget</p>
          <p className="text-2xl font-extrabold text-orange-400">${total.toLocaleString()}</p>
        </div>
      </div>

      {/* Mode toggle */}
      {hasAI && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {([
            { key: 'rental', label: 'Rental Rehab', amount: aiRental, desc: 'Rent-ready scope' },
            { key: 'flip',   label: 'Fix & Flip',   amount: aiFlip,   desc: 'Retail-ready scope' },
            { key: 'manual', label: 'Manual',        amount: parseFloat(manualAmount) || 0, desc: 'Your estimate' },
          ] as const).map(opt => (
            <button key={opt.key} type="button" onClick={() => selectMode(opt.key)}
              className={`rounded-xl p-3 text-left border transition-all ${
                mode === opt.key
                  ? opt.key === 'rental' ? 'border-blue-500 bg-blue-500/15'
                  : opt.key === 'flip'   ? 'border-orange-500 bg-orange-500/15'
                  : 'border-slate-500 bg-slate-700/50'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
              }`}>
              <p className={`text-xs font-semibold mb-0.5 ${
                mode === opt.key
                  ? opt.key === 'rental' ? 'text-blue-400' : opt.key === 'flip' ? 'text-orange-400' : 'text-slate-300'
                  : 'text-slate-400'
              }`}>{opt.label}</p>
              <p className="text-lg font-bold text-white">${opt.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-500">{opt.desc}</p>
            </button>
          ))}
        </div>
      )}

      {mode === 'manual' && (
        <div className="mb-4">
          <label className="text-xs text-slate-400 mb-1 block">Base Repair Estimate ($)</label>
          <input type="number" value={manualAmount}
            onChange={e => { setManualAmount(e.target.value); computeAndNotify(mode, e.target.value, addedItems) }}
            className="input w-full text-sm" placeholder="e.g. 25000" />
        </div>
      )}

      {hasAI && rehabScan?.summary && (
        <p className="text-xs text-slate-400 mb-3 leading-relaxed border-l-2 border-slate-600 pl-3">{rehabScan.summary}</p>
      )}

      {rehabScan?.redFlags && rehabScan.redFlags.length > 0 && (
        <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2">
          {rehabScan.redFlags.map((f, i) => (
            <p key={i} className="text-xs text-red-400">⚠ {f}</p>
          ))}
        </div>
      )}

      {hasAI && activeCategories.length > 0 && (
        <div className="mb-4">
          <button type="button" onClick={() => setShowCategories(s => !s)}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors mb-2">
            {showCategories ? '▲ Hide' : '▼ Show'} category breakdown ({activeCategories.length} items)
          </button>
          {showCategories && (
            <div className="rounded-xl border border-slate-700/40 overflow-hidden mb-2">
              {activeCategories.map((cat, i) => {
                const amt = mode === 'rental' ? cat.estimateLow : cat.estimateHigh
                return (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 ${i % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800/20'}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`text-xs font-semibold capitalize shrink-0 ${CONDITION_COLOR[cat.condition] ?? 'text-slate-400'}`}>{cat.condition}</span>
                      <span className="text-sm text-white truncate">{cat.name}</span>
                      {cat.notes && <span className="text-xs text-slate-500 truncate hidden sm:block">— {cat.notes}</span>}
                    </div>
                    <span className="text-sm font-semibold text-white shrink-0 ml-2">${amt.toLocaleString()}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Added items list */}
      {addedItems.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 font-medium mb-2">Added to Budget</p>
          <div className="space-y-1.5">
            {addedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/40">
                <span className="text-sm text-white flex-1 min-w-0 truncate">{item.description}</span>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-sm font-bold text-orange-400">${item.cost.toLocaleString()}</span>
                  <button type="button" onClick={() => removeAddedItem(item.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors text-sm leading-none">✕</button>
                </div>
              </div>
            ))}
          </div>
          {addedTotal > 0 && (
            <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/40 mt-2">
              <span>Base: ${baseAmount.toLocaleString()} + Added: ${addedTotal.toLocaleString()}</span>
              <span className="text-orange-400 font-bold">Total: ${total.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* ── AI Chat ── */}
      <div className="border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border-b border-slate-700/50">
          <span className="text-xs font-semibold text-cyan-400">🤖 Repair Chat</span>
          <span className="text-xs text-slate-500">Describe what you see — AI builds the estimate</span>
        </div>

        {/* Message history */}
        <div ref={chatContainerRef} className="max-h-72 overflow-y-auto p-3 space-y-3 bg-slate-900/40" style={{ scrollbarWidth: 'thin' }}>
          {messages.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">
              Tell me about the property condition, known issues, or what needs to be done. I'll price it out.
            </p>
          )}
          {messages.map((msg, mi) => (
            <div key={mi} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-xl px-3 py-2 max-w-[85%] text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-500/20 text-white'
                  : 'bg-slate-800/80 text-slate-200'
              }`}>
                {msg.content}
              </div>

              {/* Suggested items from this message */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="w-full space-y-2 mt-1">
                  {msg.suggestions.map((item, ii) => (
                    <div key={ii} className={`rounded-xl border p-3 transition-all ${
                      item.added ? 'border-emerald-500/30 bg-emerald-500/5 opacity-60' : 'border-slate-700/50 bg-slate-800/50'
                    }`}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm text-white font-medium flex-1">{item.description}</p>
                        {item.added && <span className="text-xs text-emerald-400 shrink-0 font-semibold">✓ Added</span>}
                      </div>
                      {item.notes && <p className="text-xs text-slate-500 mb-2">{item.notes}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500">Range:</span>
                        <span className="text-xs text-slate-300">${item.low.toLocaleString()} – ${item.high.toLocaleString()}</span>
                        {!item.added && (
                          <>
                            <button type="button" onClick={() => addSuggestion(mi, ii, 'low')}
                              className="text-xs px-2 py-0.5 rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">
                              + Low ${item.low.toLocaleString()}
                            </button>
                            <button type="button" onClick={() => addSuggestion(mi, ii, 'mid')}
                              className="text-xs px-2 py-0.5 rounded-lg border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 transition-colors font-semibold">
                              + Mid ${item.mid.toLocaleString()}
                            </button>
                            <button type="button" onClick={() => addSuggestion(mi, ii, 'high')}
                              className="text-xs px-2 py-0.5 rounded-lg border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors">
                              + High ${item.high.toLocaleString()}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <svg className="animate-spin h-3.5 w-3.5 shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Estimating...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 p-2 border-t border-slate-700/50 bg-slate-800/40">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="e.g. Roof has a leak, HVAC is original 1995, kitchen needs full gut..."
            className="input flex-1 text-sm py-2"
            disabled={sending}
          />
          <button type="button" onClick={sendMessage} disabled={!input.trim() || sending}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#00c8ff,#0066cc)', color: '#fff' }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
