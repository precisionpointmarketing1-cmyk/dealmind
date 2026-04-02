export const fmt = {
  currency: (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n),

  pct: (n: number, decimals = 1) =>
    `${(n * 100).toFixed(decimals)}%`,

  num: (n: number, decimals = 2) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n),

  grade: (score: number): string => {
    if (score >= 97) return 'A+'
    if (score >= 93) return 'A'
    if (score >= 90) return 'A-'
    if (score >= 87) return 'B+'
    if (score >= 83) return 'B'
    if (score >= 80) return 'B-'
    if (score >= 77) return 'C+'
    if (score >= 73) return 'C'
    if (score >= 70) return 'C-'
    if (score >= 60) return 'D'
    return 'F'
  },
}

export function monthlyPayment(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months
  const r = annualRate / 12
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export function loanBalance(principal: number, annualRate: number, totalMonths: number, paidMonths: number): number {
  if (annualRate === 0) return principal - (principal / totalMonths) * paidMonths
  const r = annualRate / 12
  const payment = monthlyPayment(principal, annualRate, totalMonths)
  return principal * Math.pow(1 + r, paidMonths) - payment * (Math.pow(1 + r, paidMonths) - 1) / r
}
