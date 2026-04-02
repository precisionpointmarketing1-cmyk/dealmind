export const DEFAULTS = {
  // MAO formula
  INVESTOR_DISCOUNT: 0.70,       // ARV * 70% - repairs = MAO
  LAO_DISCOUNT: 0.60,            // ARV * 60% - repairs = LAO (lowest/opening offer target)
  MIN_WHOLESALE_SPREAD: 10_000,   // minimum $10k wholesale fee

  // Operating
  VACANCY_RATE: 0.08,
  MGMT_FEE_PCT: 0.10,
  MAINTENANCE_RESERVE_PCT: 0.05,
  CAPEX_RESERVE_PCT: 0.05,

  // Financing
  DOWN_PAYMENT_PCT: 0.20,
  INTEREST_RATE: 0.075,
  LOAN_TERM_MONTHS: 360,

  // Market assumptions
  ANNUAL_APPRECIATION: 0.04,
  MARKET_CAP_RATE: 0.07,

  // Airbnb
  AIRBNB_PLATFORM_FEE: 0.03,
  AIRBNB_MGMT_FEE: 0.25,
  STR_SUPPLY_RESTOCKING_PCT: 0.04,

  // Subject-to
  EQUITY_CUSHION_MIN: 0.15,       // at least 15% equity to consider sub-to

  // Owner finance
  OWNER_FINANCE_RATE_PREMIUM: 0.02, // 2% above market = seller premium

  // Scoring thresholds
  MIN_DSCR: 1.2,
  MIN_COC: 0.08,
  MIN_CAP_RATE: 0.06,
}

export const CLOSING_COST_PCT = 0.025  // 2.5% of purchase price
export const HOLDING_COST_MONTHLY = 1_500  // est. holding costs per month
export const WHOLESALE_CLOSING_COST = 3_000

export const STRATEGY_LABELS: Record<string, string> = {
  wholesale:       'Wholesale / Cash Offer',
  'subject-to':    'Subject-To',
  'owner-finance': 'Owner Finance',
  'multi-family':  'Multi-Family (5+ Units)',
  airbnb:          'DSCR Loan / Buy & Hold',
  'buy-hold':      'Buy & Hold',
  brrrr:           'BRRRR',
  'private-money': 'Private Money / Hard Money',
  'cash-offer':    'Cash Offer',
  'listing':       'Traditional Listing',
}
