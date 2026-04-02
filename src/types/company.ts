export interface CompanySettings {
  name: string
  tagline: string
  phone: string
  email: string
  website: string
  agentName: string
  licenseNumber: string
  logoBase64: string   // base64-encoded image for PDF embedding
  primaryColor: string // hex
  accentColor: string  // hex
  address: string
  city: string
  state: string
  zip: string

  // ── Deal Assumption Defaults ──────────────────────────────────────────
  defaultEMD: number             // earnest money deposit ($)
  defaultInterestRate: number    // conventional lending rate (decimal, e.g. 0.075)
  defaultDownPaymentPct: number  // down payment % (decimal, e.g. 0.20)
  defaultLoanTermMonths: number  // loan term in months (e.g. 360)
  defaultVacancyRate: number     // vacancy rate (decimal, e.g. 0.08)
  defaultMgmtFeePct: number      // property mgmt fee (decimal, e.g. 0.10)
  defaultMaintenancePct: number  // maintenance reserve (decimal, e.g. 0.05)
  defaultAnnualAppreciation: number // annual appreciation (decimal, e.g. 0.04)
  defaultMarketCapRate: number   // market cap rate (decimal, e.g. 0.07)
  defaultHardMoneyRate: number   // hard money rate (decimal, e.g. 0.12)
  defaultHardMoneyPoints: number // hard money points (%, e.g. 2.5)
  defaultHardMoneyTermMonths: number // hard money term in months (e.g. 12)
  defaultClosingCostPct: number  // closing cost % (decimal, e.g. 0.025)
}

export const DEFAULT_COMPANY: CompanySettings = {
  name: 'House Buyers Texas',
  tagline: 'Off-Market Investment Specialists',
  phone: '',
  email: '',
  website: '',
  agentName: '',
  licenseNumber: '',
  logoBase64: '',
  primaryColor: '#00c8ff',
  accentColor: '#0066cc',
  address: '',
  city: '',
  state: 'TX',
  zip: '',

  // Deal defaults
  defaultEMD: 110,
  defaultInterestRate: 0.075,
  defaultDownPaymentPct: 0.20,
  defaultLoanTermMonths: 360,
  defaultVacancyRate: 0.08,
  defaultMgmtFeePct: 0.10,
  defaultMaintenancePct: 0.05,
  defaultAnnualAppreciation: 0.04,
  defaultMarketCapRate: 0.07,
  defaultHardMoneyRate: 0.12,
  defaultHardMoneyPoints: 2.5,
  defaultHardMoneyTermMonths: 12,
  defaultClosingCostPct: 0.025,
}
