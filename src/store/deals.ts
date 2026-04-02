import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AnalysisResult } from '@/types/deal'

// Custom storage that catches quota errors and silently drops old entries
const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) => {
    try { return localStorage.getItem(key) } catch { return null }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Quota exceeded — trim to last 3 deals and retry once
      try {
        const parsed = JSON.parse(value)
        if (parsed?.state?.deals) {
          parsed.state.deals = parsed.state.deals.slice(0, 3)
          localStorage.setItem(key, JSON.stringify(parsed))
        }
      } catch { /* give up, server is source of truth */ }
    }
  },
  removeItem: (key: string) => {
    try { localStorage.removeItem(key) } catch { }
  },
}))

export interface SavedDeal {
  id: string
  savedAt: string
  nickname?: string
  result: AnalysisResult
}

interface DealsStore {
  deals: SavedDeal[]
  loaded: boolean
  loadDeals: () => Promise<void>
  saveDeal: (result: AnalysisResult) => Promise<SavedDeal>
  deleteDeal: (id: string) => Promise<void>
  renameDeal: (id: string, nickname: string) => Promise<void>
}

export const useDealsStore = create<DealsStore>()(
  persist(
    (set, get) => ({
      deals: [],
      loaded: false,

      loadDeals: async () => {
        try {
          const res = await fetch('/api/deals')
          if (res.ok) {
            const deals = await res.json()
            set({ deals, loaded: true })
          }
        } catch {
          set({ loaded: true })
        }
      },

      saveDeal: async (result) => {
        const deal: SavedDeal = {
          id: `deal_${Date.now()}`,
          savedAt: new Date().toISOString(),
          result,
        }
        set(s => ({ deals: [deal, ...s.deals] }))
        try {
          await fetch('/api/deals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deal),
          })
        } catch { /* keep in localStorage if server fails */ }
        return deal
      },

      deleteDeal: async (id) => {
        set(s => ({ deals: s.deals.filter(d => d.id !== id) }))
        try {
          await fetch('/api/deals', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          })
        } catch { }
      },

      renameDeal: async (id, nickname) => {
        set(s => ({
          deals: s.deals.map(d => d.id === id ? { ...d, nickname } : d),
        }))
        const deal = get().deals.find(d => d.id === id)
        if (deal) {
          try {
            await fetch('/api/deals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...deal, nickname }),
            })
          } catch { }
        }
      },
    }),
    { name: 'dealmind-saved-deals', storage: safeStorage }
  )
)
