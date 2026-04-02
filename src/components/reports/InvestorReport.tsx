import { Document, Page, View, Text, Image, Link, StyleSheet } from '@react-pdf/renderer'
import { AnalysisResult, SaleComp } from '@/types/deal'
import { CompanySettings } from '@/types/company'

interface Props {
  result: AnalysisResult
  company: CompanySettings
  photos?: string[]
  mapImageUrl?: string
  selectedComps?: SaleComp[]
  selectedARV?: number
  addedRepairItems?: { description: string; cost: number }[]
}

function cur(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function pct(n: number) { return `${(n * 100).toFixed(1)}%` }
function scoreColor(n: number) { return n >= 70 ? '#10b981' : n >= 40 ? '#f59e0b' : '#ef4444' }
function fmtDate(raw: string | undefined | null): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw.includes('T') ? raw : raw + 'T12:00:00')
    if (isNaN(d.getTime())) return raw.slice(0, 10) || '—'
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch { return '—' }
}

function zillowUrl(address: string) {
  return `https://www.zillow.com/homes/${encodeURIComponent(address)}_rb/`
}

function gradeHex(g: string) {
  if (g.startsWith('A')) return '#10b981'
  if (g.startsWith('B')) return '#3b82f6'
  if (g.startsWith('C')) return '#f59e0b'
  if (g.startsWith('D')) return '#f97316'
  return '#ef4444'
}


export function InvestorReport({ result, company, photos = [], mapImageUrl, selectedComps, selectedARV, addedRepairItems }: Props) {
  const primary = company.primaryColor || '#00c8ff'
  const accent  = company.accentColor  || '#0066cc'

  const C = {
    navy:    '#0b0f1e',
    navyMid: '#0f1628',
    navyLt:  '#1a2035',
    cyan:    primary,
    blue:    accent,
    white:   '#ffffff',
    slate:   '#94a3b8',
    slateLt: '#cbd5e1',
    green:   '#10b981',
    yellow:  '#f59e0b',
    red:     '#ef4444',
    bgLight: '#f8fafc',
    border:  '#e2e8f0',
    text:    '#1e293b',
    textMid: '#475569',
  }

  const s = StyleSheet.create({
    page:        { backgroundColor: C.white, padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: C.text },
    // Header — light, clean, matches InvestorReport style
    header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: C.cyan },
    logo:        { width: 100, height: 40, objectFit: 'contain' },
    // Address bar
    addrBar:     { backgroundColor: C.navyMid, padding: 12, borderRadius: 5, marginBottom: 16 },
    addrText:    { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white },
    addrSub:     { fontSize: 9, color: C.slate, marginTop: 3 },
    // Section
    section:     { marginBottom: 16 },
    sectionHead: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.border, textTransform: 'uppercase', letterSpacing: 0.5 },
    // Stat boxes
    statBox:     { backgroundColor: C.bgLight, borderRadius: 4, padding: 9, flex: 1 },
    statLabel:   { fontSize: 8, color: C.textMid, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
    statValue:   { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.text },
    statSub:     { fontSize: 8, color: C.slate, marginTop: 1 },
    // Hero purchase price box
    heroBox:     { backgroundColor: C.navyMid, borderRadius: 5, padding: 14, alignItems: 'center', flex: 1, borderWidth: 1, borderColor: C.cyan },
    heroLabel:   { fontSize: 8, color: C.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 3, textTransform: 'uppercase' },
    heroValue:   { fontSize: 32, fontFamily: 'Helvetica-Bold', color: C.white },
    heroSub:     { fontSize: 8, color: C.slate, marginTop: 2 },
    // Table
    tableHead:   { flexDirection: 'row', backgroundColor: C.navyMid, borderRadius: 3, paddingVertical: 6, paddingHorizontal: 6, marginBottom: 2 },
    tableHeadTx: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.cyan },
    tableRow:    { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.border },
    tableTx:     { fontSize: 9, color: C.text },
    tableHigh:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text },
    // Bullet
    bullet:      { flexDirection: 'row', marginBottom: 3 },
    bulletDot:   { fontSize: 9, color: C.cyan, marginRight: 4, marginTop: 1 },
    bulletTx:    { fontSize: 9, color: C.textMid, flex: 1 },
    // Footer
    footer:      { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
    footerTx:    { fontSize: 8, color: C.slate },
  })

  const { input, coreMetrics: m, wholesale, subjectTo, airbnb, brrrr, arv, aiAnalysis, rentComps, saleComps, rehabScan } = result
  const marketRent      = rentComps?.rentAvg ?? 0
  const airbnbMarket    = result.airbnbMarket
  const effectiveARV    = selectedARV && selectedARV > 0 ? selectedARV : arv.adjustedARV
  const contractPrice   = m.mao                                                 // MAO — max we pay seller (never asking price)
  const assignmentFee   = (input.assignmentFee && input.assignmentFee > 0) ? input.assignmentFee : 0
  const assignmentPrice = contractPrice + assignmentFee                         // investor's buy price = MAO + assignment fee
  const purchasePrice   = assignmentPrice                                       // hero on report = investor's price
  const allPhotos       = photos.length > 0 ? photos : (result.propertyPhotos ?? [])
  const dateStr      = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Use user-selected comps if provided (all statuses); otherwise fall back to sold comps only
  const compsToShow = (
    selectedComps && selectedComps.length > 0
      ? selectedComps
      : (saleComps?.comparables ?? []).filter(c => c.status === 'sold')
  ).slice(0, 20)

  // ── Fix & Flip / Hard Money Full Deal Waterfall ──────────────────────────────
  const holdMonths     = 6                                         // standard flip timeline
  const hmLoan         = Math.round(effectiveARV * 0.70)          // 70% of ARV
  const hmOrigination  = Math.round(hmLoan * 0.02)                // 2 pts
  const hmMonthlyInt   = Math.round(hmLoan * 0.12 / 12)           // 12% I/O
  const hmTotalInt     = hmMonthlyInt * holdMonths                 // total interest over hold
  const hmInsurance    = Math.round((assignmentPrice * 0.006) / 12 * holdMonths)  // ~0.6% annualized
  const hmClosingBuy   = Math.round(assignmentPrice * 0.025)       // ~2.5% at purchase
  const hmRealtorFees  = Math.round(effectiveARV * 0.055)          // 5.5% commission at sale
  const hmClosingSell  = Math.round(effectiveARV * 0.01)           // ~1% at closing/exit
  const hmRepairs      = input.estimatedRepairs ?? 0
  const hmAllInCost    = assignmentPrice + hmOrigination + hmTotalInt + hmInsurance + hmClosingBuy + hmRealtorFees + hmClosingSell + hmRepairs
  const hmNetProfit    = effectiveARV - hmAllInCost
  const hmROI          = assignmentPrice > 0 ? hmNetProfit / assignmentPrice : 0
  const hmOutOfPocket  = Math.max(0, hmAllInCost - hmLoan)         // cash investor must bring

  // Ranked investor exit strategies for Page 6 summary
  const investorExits = [
    { key: 'Fix & Flip',        score: wholesale.dealScore,                color: C.yellow,   accent: C.yellow   },
    { key: 'BRRRR',             score: brrrr?.dealScore ?? 0,              color: C.cyan,     accent: C.cyan     },
    { key: 'Buy & Hold (DSCR)', score: airbnb.ltrQualifies ? 75 : 35,     color: '#3b82f6',  accent: '#3b82f6'  },
    { key: 'Short-Term Rental', score: airbnb.strQualifies ? 80 : 35,     color: '#ec4899',  accent: '#ec4899'  },
  ].sort((a, b) => b.score - a.score)
  const topExit = investorExits[0]

  // ARV estimates
  const arvEstimates = [
    { label: 'RentCast AVM',   value: arv.rentCastARV },
    { label: 'Comp $/sqft',    value: arv.compBasedARV },
    { label: 'Comp Median',    value: arv.compMedianARV },
    { label: 'AI Estimate',    value: arv.aiEstimatedARV },
    { label: 'Your Estimate',  value: input.estimatedARV > 0 ? input.estimatedARV : undefined },
  ].filter(e => e.value && e.value > 0) as { label: string; value: number }[]

  return (
    <Document>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 1 — Overview
      ═══════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            {company.logoBase64
              ? <Image src={company.logoBase64} style={s.logo} />
              : <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.cyan }}>{company.name}</Text>}
            <Text style={{ fontSize: 8, color: C.textMid, marginTop: 2 }}>{company.tagline}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.navyMid }}>INVESTOR DEAL REPORT</Text>
            <Text style={{ fontSize: 8, color: C.textMid, marginTop: 2 }}>{dateStr}</Text>
            {company.agentName && <Text style={{ fontSize: 8, color: C.textMid }}>Prepared by: {company.agentName}</Text>}
            {company.phone && <Text style={{ fontSize: 8, color: C.textMid }}>{company.phone}</Text>}
            {company.email && <Text style={{ fontSize: 8, color: C.textMid }}>{company.email}</Text>}
          </View>
        </View>

        {/* Address bar */}
        <View style={s.addrBar}>
          <Text style={s.addrText}>{input.address}, {input.city}, {input.state} {input.zip}</Text>
          <Text style={s.addrSub}>
            {input.propertyType.replace(/-/g, ' ')} · {input.bedrooms} bed / {input.bathrooms} bath · {(input.sqft ?? 0).toLocaleString()} sqft · Built {input.yearBuilt}
          </Text>
        </View>

        {/* Hero row: Assignment Price + key stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={s.heroBox}>
            <Text style={s.heroLabel}>Your Purchase Price</Text>
            <Text style={s.heroValue}>{cur(assignmentPrice)}</Text>
            <Text style={s.heroSub}>Total investor acquisition cost</Text>
          </View>
          <View style={{ flex: 2, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={s.statBox}>
                <Text style={s.statLabel}>{selectedARV && selectedARV > 0 ? 'Comps-Adjusted ARV' : 'Consensus ARV'}</Text>
                <Text style={s.statValue}>{cur(effectiveARV)}</Text>
                <Text style={s.statSub}>{selectedARV && selectedARV > 0 ? 'from selected comps' : `${arv.compsUsed} comps · ${arv.confidence} conf.`}</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statLabel}>Market Rent</Text>
                <Text style={s.statValue}>{marketRent > 0 ? cur(marketRent) + '/mo' : '—'}</Text>
                <Text style={s.statSub}>RentCast estimate</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={s.statBox}>
                <Text style={s.statLabel}>Repair Budget</Text>
                <Text style={s.statValue}>{cur(input.estimatedRepairs ?? 0)}</Text>
                <Text style={s.statSub}>{rehabScan ? 'AI photo estimate' : 'As entered'}</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statLabel}>Investor Equity</Text>
                <Text style={{ ...s.statValue, color: C.green }}>{cur(effectiveARV - assignmentPrice - (input.estimatedRepairs ?? 0))}</Text>
                <Text style={s.statSub}>ARV − price − repairs</Text>
              </View>
            </View>
          </View>
        </View>

        {/* AI Overview */}
        {aiAnalysis?.dealSummary && (
          <View style={{ backgroundColor: '#f0f9ff', borderRadius: 4, padding: 10, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: C.cyan }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.blue, marginBottom: 3 }}>AI DEAL ANALYSIS</Text>
            <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.5 }}>{aiAnalysis.dealSummary}</Text>
          </View>
        )}

        {/* Property Photo Walkthrough */}
        {allPhotos.length > 0 && (() => {
          const labels  = rehabScan?.photoLabels ?? []
          const order   = rehabScan?.photoOrder ?? allPhotos.map((_, i) => i)
          // Build ordered list, then split into rows of 3
          const ordered = order.map(idx => ({ src: allPhotos[idx], label: labels[idx] ?? '' }))
          const rows: typeof ordered[] = []
          for (let i = 0; i < ordered.length; i += 3) rows.push(ordered.slice(i, i + 3))
          return (
            <View style={s.section}>
              <Text style={s.sectionHead}>Property Walkthrough · {allPhotos.length} Photos</Text>
              {rows.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 5, marginBottom: 5 }} wrap={false}>
                  {row.map((item, ci) => (
                    <View key={ci} style={{ flex: 1 }}>
                      <Image src={item.src} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 3, borderWidth: 1, borderColor: C.border }} />
                      {item.label ? (
                        <Text style={{ fontSize: 7, color: C.textMid, marginTop: 2, textAlign: 'center' }}>{item.label}</Text>
                      ) : null}
                    </View>
                  ))}
                  {/* Pad last row if fewer than 3 */}
                  {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, pi) => (
                    <View key={`pad-${pi}`} style={{ flex: 1 }} />
                  ))}
                </View>
              ))}
            </View>
          )
        })()}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{company.name} · {company.phone} · {company.email}</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 2 — Comps & Map
      ═══════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page}>

        {/* ARV Comparable Sales */}
        <View style={s.section}>
          <Text style={s.sectionHead}>ARV Comparable Sales ({compsToShow.length} comps used)</Text>

          {/* Table header */}
          <View style={s.tableHead}>
            <Text style={{ ...s.tableHeadTx, flex: 3 }}>Address</Text>
            <Text style={{ ...s.tableHeadTx, width: 22, textAlign: 'center' }}>Bd</Text>
            <Text style={{ ...s.tableHeadTx, width: 22, textAlign: 'center' }}>Ba</Text>
            <Text style={{ ...s.tableHeadTx, width: 38, textAlign: 'right' }}>Sqft</Text>
            <Text style={{ ...s.tableHeadTx, width: 58, textAlign: 'right' }}>Sale Price</Text>
            <Text style={{ ...s.tableHeadTx, width: 40, textAlign: 'right' }}>$/sqft</Text>
            <Text style={{ ...s.tableHeadTx, width: 48, textAlign: 'center' }}>Sold Date</Text>
            <Text style={{ ...s.tableHeadTx, width: 34, textAlign: 'center' }}>Yr Blt</Text>
            <Text style={{ ...s.tableHeadTx, width: 28, textAlign: 'center' }}>Dist</Text>
            <Text style={{ ...s.tableHeadTx, width: 26, textAlign: 'center' }}>DOM</Text>
            <Text style={{ ...s.tableHeadTx, width: 34, textAlign: 'center' }}>Zillow</Text>
          </View>

          {compsToShow.map((c, i) => (
            <View key={i} style={{ ...s.tableRow, backgroundColor: i % 2 === 0 ? C.white : C.bgLight }}>
              <Text style={{ ...s.tableTx, flex: 3 }}>{c.address}</Text>
              <Text style={{ ...s.tableTx, width: 22, textAlign: 'center' }}>{c.bedrooms}</Text>
              <Text style={{ ...s.tableTx, width: 22, textAlign: 'center' }}>{c.bathrooms}</Text>
              <Text style={{ ...s.tableTx, width: 38, textAlign: 'right' }}>{c.sqft.toLocaleString()}</Text>
              <Text style={{ ...s.tableHigh, width: 58, textAlign: 'right' }}>{cur(c.salePrice)}</Text>
              <Text style={{ ...s.tableTx, width: 40, textAlign: 'right' }}>${c.pricePerSqft.toFixed(0)}</Text>
              <Text style={{ ...s.tableTx, width: 48, textAlign: 'center' }}>{fmtDate(c.soldDate)}</Text>
              <Text style={{ ...s.tableTx, width: 34, textAlign: 'center' }}>{c.yearBuilt ?? '—'}</Text>
              <Text style={{ ...s.tableTx, width: 28, textAlign: 'center' }}>
                {c.distance > 0 ? `${c.distance.toFixed(1)}mi` : '—'}
              </Text>
              <Text style={{ ...s.tableTx, width: 26, textAlign: 'center' }}>
                {c.daysOnMarket != null ? `${c.daysOnMarket}d` : '—'}
              </Text>
              <View style={{ width: 34, alignItems: 'center' }}>
                <Link src={zillowUrl(c.address)}>
                  <Text style={{ fontSize: 7, color: C.blue, textDecoration: 'underline' }}>Zillow ↗</Text>
                </Link>
              </View>
            </View>
          ))}
        </View>

        {/* ARV Estimates Summary */}
        {arvEstimates.length > 0 && (
          <View style={{ ...s.section, marginBottom: 14 }}>
            <Text style={s.sectionHead}>ARV Estimate Comparison</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {arvEstimates.map(e => (
                <View key={e.label} style={{ ...s.statBox, flex: undefined, width: 100 }}>
                  <Text style={s.statLabel}>{e.label}</Text>
                  <Text style={s.statValue}>{cur(e.value)}</Text>
                </View>
              ))}
              <View style={{ ...s.statBox, flex: undefined, width: 100, backgroundColor: C.navyMid, borderWidth: 1, borderColor: C.cyan }}>
                <Text style={{ ...s.statLabel, color: C.cyan }}>{selectedARV && selectedARV > 0 ? 'Comps-Adj.' : 'Consensus'}</Text>
                <Text style={{ ...s.statValue, color: C.white }}>{cur(effectiveARV)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Comp Map */}
        {mapImageUrl && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Comp Location Map</Text>
            <Image src={mapImageUrl} style={{ width: '100%', height: 220, borderRadius: 4, objectFit: 'cover' }} />
            <Text style={{ fontSize: 7, color: C.slate, marginTop: 4 }}>
              ★ Gold star = subject property · Blue pins = comparable sales
            </Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{company.name} · {company.phone} · {company.email}</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 3 — Rehab Budget
      ═══════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page}>

        {/* Rehab Budget */}
        {rehabScan && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Estimated Rehab Budget — {cur(rehabScan.totalEstimate)} ({rehabScan.confidence} confidence)</Text>
            <Text style={{ fontSize: 8, color: C.textMid, marginBottom: 8 }}>{rehabScan.summary}</Text>

            <View style={s.tableHead}>
              <Text style={{ ...s.tableHeadTx, flex: 3 }}>Category</Text>
              <Text style={{ ...s.tableHeadTx, width: 60, textAlign: 'center' }}>Condition</Text>
              <Text style={{ ...s.tableHeadTx, width: 70, textAlign: 'right' }}>Low Est.</Text>
              <Text style={{ ...s.tableHeadTx, width: 70, textAlign: 'right' }}>High Est.</Text>
            </View>
            {rehabScan.categories.map((cat, i) => (
              <View key={i} style={{ ...s.tableRow, backgroundColor: i % 2 === 0 ? C.white : C.bgLight }}>
                <Text style={{ ...s.tableTx, flex: 3 }}>{cat.name}</Text>
                <Text style={{ ...s.tableTx, width: 60, textAlign: 'center', color: cat.condition === 'poor' ? C.red : cat.condition === 'fair' ? C.yellow : C.green }}>
                  {cat.condition}
                </Text>
                <Text style={{ ...s.tableTx, width: 70, textAlign: 'right' }}>{cur(cat.estimateLow)}</Text>
                <Text style={{ ...s.tableHigh, width: 70, textAlign: 'right' }}>{cur(cat.estimateHigh)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: C.bgLight, borderRadius: 3, marginTop: 4 }}>
              <Text style={{ ...s.tableHigh, flex: 3 }}>TOTAL</Text>
              <Text style={{ width: 60 }} />
              <Text style={{ ...s.tableHigh, width: 70, textAlign: 'right' }}>
                {cur(rehabScan.categories.reduce((s, c) => s + c.estimateLow, 0))}
              </Text>
              <Text style={{ ...s.tableHigh, width: 70, textAlign: 'right', color: C.cyan }}>
                {cur(rehabScan.totalEstimate)}
              </Text>
            </View>
          </View>
        )}

        {/* AI chat repair items */}
        {addedRepairItems && addedRepairItems.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Additional Repair Items (Added During Analysis)</Text>
            <View style={s.tableHead}>
              <Text style={{ ...s.tableHeadTx, flex: 3 }}>Item</Text>
              <Text style={{ ...s.tableHeadTx, width: 70, textAlign: 'right' }}>Cost</Text>
            </View>
            {addedRepairItems.map((item, i) => (
              <View key={i} style={{ ...s.tableRow, backgroundColor: i % 2 === 0 ? C.white : C.bgLight }}>
                <Text style={{ ...s.tableTx, flex: 3 }}>{item.description}</Text>
                <Text style={{ ...s.tableTx, width: 70, textAlign: 'right' }}>{cur(item.cost)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: C.bgLight, borderRadius: 3, marginTop: 4 }}>
              <Text style={{ ...s.tableHigh, flex: 3 }}>TOTAL</Text>
              <Text style={{ ...s.tableHigh, width: 70, textAlign: 'right', color: C.cyan }}>
                {cur(addedRepairItems.reduce((s, i) => s + i.cost, 0))}
              </Text>
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{company.name} · {company.phone} · {company.email}</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 4 — Core Investment Metrics + Hard Money / Fix & Flip
      ═══════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page}>

        {/* Core Investment Metrics */}
        <View style={s.section}>
          <Text style={s.sectionHead}>Core Investment Metrics (Conventional — 20% Down)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {[
              { label: 'Monthly Cash Flow', value: cur(m.monthlyCashFlow), good: m.monthlyCashFlow > 0 },
              { label: 'Cap Rate',          value: pct(m.capRate),          good: m.capRate >= 0.06 },
              { label: 'Cash-on-Cash',      value: pct(m.cashOnCashReturn), good: m.cashOnCashReturn >= 0.08 },
              { label: 'NOI (Annual)',       value: cur(m.noi),              good: m.noi > 0 },
              { label: 'DSCR',              value: `${m.dscr.toFixed(2)}x`, good: m.dscr >= 1.2 },
              { label: 'GRM',               value: `${m.grm.toFixed(1)}x`,  good: m.grm < 12 },
              { label: 'Equity at Purchase',value: cur(m.equityAtPurchase), good: m.equityAtPurchase > 0 },
              { label: '5-Yr Appreciation', value: cur(m.appreciationAt5yr),good: true },
              { label: '5-Yr Total Return', value: cur(m.totalProjectedReturn5yr), good: true },
            ].map(item => (
              <View key={item.label} style={{ ...s.statBox, width: '30%', flex: undefined }}>
                <Text style={s.statLabel}>{item.label}</Text>
                <Text style={{ ...s.statValue, fontSize: 11, color: item.good ? C.text : C.red }}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Hard Money / Fix & Flip Full Deal Analysis */}
        <View style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.yellow }}>
          <View style={{ backgroundColor: C.navyMid, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 7, color: C.yellow, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' }}>Exit Strategy — Fix &amp; Flip</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, marginTop: 1 }}>Hard Money Full Deal Waterfall · {holdMonths}-Month Hold</Text>
            </View>
            <View style={{ backgroundColor: scoreColor(wholesale.dealScore), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', minWidth: 44 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white }}>{wholesale.dealScore}</Text>
              <Text style={{ fontSize: 6, color: C.white }}>score</Text>
            </View>
          </View>
          <View style={{ backgroundColor: C.bgLight, padding: 10 }}>
          <View style={{ backgroundColor: '#fef9f0', borderRadius: 4, padding: 7, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: C.yellow }}>
            <Text style={{ fontSize: 8, color: C.textMid }}>
              HM Loan: {cur(hmLoan)} (70% ARV) · 2 pts origination · 12% I/O · {holdMonths}-month hold · Exit at ARV
            </Text>
          </View>

          {/* Acquisition */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Acquisition</Text>
            {[
              { label: 'Purchase / Assignment Price', value: cur(assignmentPrice), indent: false },
              { label: 'Hard Money Loan (70% ARV)',   value: `(${cur(hmLoan)})`, note: 'funded by lender', color: C.green },
              { label: 'Origination Fee (2 pts)',     value: cur(hmOrigination) },
              { label: 'Closing Costs at Purchase',   value: cur(hmClosingBuy), note: '~2.5%' },
            ].map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 6, backgroundColor: i % 2 === 0 ? C.bgLight : C.white, borderRadius: 2 }}>
                <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
                  <Text style={{ fontSize: 8, color: C.textMid }}>{r.label}</Text>
                  {r.note && <Text style={{ fontSize: 7, color: C.slate }}>({r.note})</Text>}
                </View>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: r.color ?? C.text }}>{r.value}</Text>
              </View>
            ))}
          </View>

          {/* Holding / Carry Costs */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Carry Costs ({holdMonths} months)</Text>
            {[
              { label: 'Rehab / Repair Budget',                    value: cur(hmRepairs) },
              { label: `Total Interest Payments (${cur(hmMonthlyInt)}/mo × ${holdMonths})`, value: cur(hmTotalInt) },
              { label: 'Insurance During Hold',                    value: cur(hmInsurance), note: '~0.6% annualized' },
            ].map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 6, backgroundColor: i % 2 === 0 ? C.bgLight : C.white, borderRadius: 2 }}>
                <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
                  <Text style={{ fontSize: 8, color: C.textMid }}>{r.label}</Text>
                  {r.note && <Text style={{ fontSize: 7, color: C.slate }}>({r.note})</Text>}
                </View>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.text }}>{r.value}</Text>
              </View>
            ))}
          </View>

          {/* Exit / Sale Costs */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Exit / Sale</Text>
            {[
              { label: 'Sale Price (ARV)',         value: cur(effectiveARV), color: C.green },
              { label: 'Realtor Commission',       value: `(${cur(hmRealtorFees)})`, note: '5.5%' },
              { label: 'Closing Costs at Sale',    value: `(${cur(hmClosingSell)})`, note: '~1%' },
            ].map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 6, backgroundColor: i % 2 === 0 ? C.bgLight : C.white, borderRadius: 2 }}>
                <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
                  <Text style={{ fontSize: 8, color: C.textMid }}>{r.label}</Text>
                  {r.note && <Text style={{ fontSize: 7, color: C.slate }}>({r.note})</Text>}
                </View>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: r.color ?? C.text }}>{r.value}</Text>
              </View>
            ))}
          </View>

          {/* Summary totals */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ ...s.statBox, flex: 1 }}>
              <Text style={s.statLabel}>Total All-In Cost</Text>
              <Text style={{ ...s.statValue, fontSize: 13 }}>{cur(hmAllInCost)}</Text>
              <Text style={s.statSub}>purchase + rehab + all fees</Text>
            </View>
            <View style={{ ...s.statBox, flex: 1 }}>
              <Text style={s.statLabel}>Out-of-Pocket Cash</Text>
              <Text style={{ ...s.statValue, fontSize: 13 }}>{cur(hmOutOfPocket)}</Text>
              <Text style={s.statSub}>beyond what loan covers</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: hmNetProfit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 4, padding: 9, borderWidth: 1, borderColor: hmNetProfit >= 0 ? C.green : C.red }}>
              <Text style={{ ...s.statLabel, color: hmNetProfit >= 0 ? C.green : C.red }}>Net Profit</Text>
              <Text style={{ ...s.statValue, fontSize: 13, color: hmNetProfit >= 0 ? C.green : C.red }}>{cur(hmNetProfit)}</Text>
              <Text style={{ ...s.statSub, color: hmNetProfit >= 0 ? C.green : C.red }}>ROI: {pct(hmROI)}</Text>
            </View>
          </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{company.name} · {company.phone} · {company.email}</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 5 — Investor Financing: BRRRR + DSCR / Buy & Hold
      ═══════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page}>

        {/* BRRRR Analysis */}
        {brrrr && (
          <View style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.cyan }}>
            <View style={{ backgroundColor: C.navyMid, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 7, color: C.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' }}>Exit Strategy — BRRRR</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, marginTop: 1 }}>Buy · Rehab · Rent · Refi · Repeat</Text>
              </View>
              <View style={{ backgroundColor: scoreColor(brrrr.dealScore), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', minWidth: 44 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white }}>{brrrr.dealScore}</Text>
                <Text style={{ fontSize: 6, color: C.white }}>score</Text>
              </View>
            </View>
            <View style={{ backgroundColor: C.bgLight, padding: 10 }}>
            <View style={{ backgroundColor: '#f0f9ff', borderRadius: 4, padding: 7, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: C.cyan }}>
              <Text style={{ fontSize: 8, color: C.textMid }}>
                Buy at cash price, renovate, rent, refinance at 75% ARV — recycle capital into the next deal.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'Total Cash In',        value: cur(brrrr.totalCashIn),      good: true },
                { label: 'Refi Loan (75% ARV)',  value: cur(brrrr.refiLoanAmount),   good: true },
                { label: 'Cash Returned',        value: cur(brrrr.cashReturned),     good: brrrr.cashReturned > 0 },
                { label: 'Cash Left in Deal',    value: cur(brrrr.cashLeftInDeal),   good: brrrr.cashLeftInDeal < brrrr.totalCashIn * 0.2 },
                { label: 'Refi Coverage',        value: pct(brrrr.refiCoverage),     good: brrrr.refiCoverage >= 0.75 },
                { label: 'Equity Capture',       value: cur(brrrr.equityCapture),    good: brrrr.equityCapture > 30_000 },
              ].map(item => (
                <View key={item.label} style={{ ...s.statBox, flex: 1 }}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={{ ...s.statValue, fontSize: 10, color: item.good ? C.text : C.red }}>{item.value}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'Refi Payment',       value: `${cur(brrrr.refiMonthlyPayment)}/mo`,   good: true },
                { label: 'Market Rent',        value: `${cur(brrrr.marketRent)}/mo`,            good: true },
                { label: 'Monthly Cash Flow',  value: `${cur(brrrr.monthlyCashFlow)}/mo`,       good: brrrr.monthlyCashFlow >= 0 },
                { label: 'Cash-on-Cash',       value: brrrr.cashOnCash >= 9.99 ? '∞' : pct(brrrr.cashOnCash), good: brrrr.cashOnCash > 0.10 },
              ].map(item => (
                <View key={item.label} style={{ ...s.statBox, flex: 1 }}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={{ ...s.statValue, fontSize: 10, color: item.good ? C.text : C.red }}>{item.value}</Text>
                </View>
              ))}
              <View style={{ flex: 2, backgroundColor: brrrr.eligible ? '#f0fdf4' : '#fef2f2', borderRadius: 4, padding: 9, borderWidth: 1, borderColor: brrrr.eligible ? C.green : C.red, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: brrrr.eligible ? C.green : C.red }}>{brrrr.eligible ? '✓ BRRRR VIABLE' : '✗ BRRRR NOT VIABLE'}</Text>
                <Text style={{ fontSize: 8, color: C.textMid, marginTop: 3 }}>Score: {brrrr.dealScore}/100</Text>
              </View>
            </View>
            </View>
          </View>
        )}

        {/* DSCR Loan / Buy & Hold Analysis */}
        <View style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#3b82f6' }}>
          <View style={{ backgroundColor: C.navyMid, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 7, color: '#60a5fa', fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' }}>Exit Strategy — Buy &amp; Hold / STR</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, marginTop: 1 }}>DSCR Loan — Buy &amp; Hold / STR Analysis</Text>
            </View>
            <View style={{ backgroundColor: scoreColor(airbnb.dealScore), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', minWidth: 44 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white }}>{airbnb.dealScore}</Text>
              <Text style={{ fontSize: 6, color: C.white }}>score</Text>
            </View>
          </View>
          <View style={{ backgroundColor: C.bgLight, padding: 10 }}>
          <View style={{ backgroundColor: '#f0f9ff', borderRadius: 4, padding: 7, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: '#3b82f6' }}>
            <Text style={{ fontSize: 8, color: C.textMid }}>
              DSCR loans qualify on property income, not borrower income. Min DSCR 1.0x. Rate typically 7.5%+.
            </Text>
          </View>

          {/* DSCR Loan Terms */}
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>Loan Terms</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Loan Amount (75% LTV)',  value: cur(airbnb.dscrLoanAmount ?? 0) },
              { label: 'Down Payment (25%)',     value: cur(airbnb.dscrDownPayment ?? 0) },
              { label: 'DSCR Rate',             value: pct(airbnb.dscrRate ?? 0) },
              { label: 'Monthly P&I',           value: `${cur(airbnb.dscrMonthlyPayment ?? 0)}/mo` },
              { label: 'Monthly PITIA',         value: `${cur(airbnb.dscrMonthlyPITIA ?? 0)}/mo` },
            ].map(item => (
              <View key={item.label} style={{ ...s.statBox, flex: 1 }}>
                <Text style={s.statLabel}>{item.label}</Text>
                <Text style={{ ...s.statValue, fontSize: 10 }}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* LTR vs STR side by side */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* LTR */}
            <View style={{ flex: 1, backgroundColor: C.bgLight, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: airbnb.ltrQualifies ? C.green : C.border }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 6, textTransform: 'uppercase' }}>Long-Term Rental (LTR)</Text>
              {[
                { label: 'Market Rent',     value: `${cur(airbnb.ltrMonthlyRent ?? 0)}/mo` },
                { label: 'LTR DSCR',        value: `${(airbnb.ltrDSCR ?? 0).toFixed(2)}x` },
                { label: 'DSCR Qualifies',  value: airbnb.ltrQualifies ? '✓ Yes (≥1.0)' : '✗ No (<1.0)' },
                { label: 'Monthly Cash Flow', value: `${cur(airbnb.ltrMonthlyCashFlow ?? 0)}/mo` },
                { label: 'LTR Cash-on-Cash', value: pct(airbnb.ltrCashOnCash ?? 0) },
              ].map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ fontSize: 8, color: C.textMid }}>{row.label}</Text>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: row.label === 'DSCR Qualifies' ? (airbnb.ltrQualifies ? C.green : C.red) : C.text }}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* STR / Airbnb */}
            <View style={{ flex: 1, backgroundColor: C.bgLight, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: airbnb.strQualifies ? C.green : C.border }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 6, textTransform: 'uppercase' }}>Short-Term Rental / Airbnb (STR)</Text>
              {[
                { label: 'Gross STR Revenue',      value: `${cur(airbnb.monthlyRevenue)}/mo` },
                { label: 'Annual STR Revenue',     value: cur(airbnb.annualRevenue) },
                { label: 'STR DSCR (75% haircut)', value: `${(airbnb.strDSCR ?? 0).toFixed(2)}x` },
                { label: 'STR Qualifies',          value: airbnb.strQualifies ? '✓ Yes (≥1.0)' : '✗ No (<1.0)' },
                { label: 'STR Net Income',         value: `${cur(airbnb.monthlyNetIncome)}/mo` },
                { label: 'STR Cash-on-Cash',       value: pct(airbnb.cashOnCash) },
                { label: 'STR vs LTR Premium',     value: `${(airbnb.vsLongTermRental ?? 0) >= 0 ? '+' : ''}${cur(airbnb.vsLongTermRental ?? 0)}/yr` },
              ].map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ fontSize: 8, color: C.textMid }}>{row.label}</Text>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: row.label === 'STR Qualifies' ? (airbnb.strQualifies ? C.green : C.red) : C.text }}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
          </View>
        </View>

        {/* Airbnb Market Data (HasData) */}
        {result.airbnbMarket && (
          <View style={{ ...s.section, marginTop: 8 }}>
            <Text style={s.sectionHead}>Live Airbnb Market Data</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'Median Nightly Rate', value: `$${result.airbnbMarket.medianNightlyRate}/night` },
                { label: 'Avg Nightly Rate',    value: `$${result.airbnbMarket.averageNightlyRate}/night` },
                { label: 'Est. Occupancy',      value: pct(result.airbnbMarket.estimatedOccupancy) },
                { label: 'Price Range',         value: `$${result.airbnbMarket.priceRange.low}–$${result.airbnbMarket.priceRange.high}` },
                { label: 'Active Listings',     value: String(result.airbnbMarket.sampleCount) },
              ].map(item => (
                <View key={item.label} style={{ ...s.statBox, flex: 1 }}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={{ ...s.statValue, fontSize: 10 }}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{company.name} · {company.phone} · {company.email}</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 6 — Investor Exit Strategies
      ═══════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page}>

        {/* Page title */}
        <View style={{ backgroundColor: C.navyMid, borderRadius: 5, padding: 12, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white }}>INVESTOR EXIT STRATEGIES</Text>
            <Text style={{ fontSize: 8, color: C.slate, marginTop: 2 }}>
              {input.address}, {input.city}, {input.state} · Purchase price: {cur(purchasePrice)} · ARV: {cur(effectiveARV)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: C.slate }}>Equity at purchase</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.cyan }}>
              {cur(effectiveARV - purchasePrice - (input.estimatedRepairs ?? 0))}
            </Text>
          </View>
        </View>

        {/* ── Best Strategy Summary ── */}
        <View style={{ backgroundColor: C.bgLight, borderRadius: 5, padding: 10, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: topExit.color }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View>
              <Text style={{ fontSize: 7, color: C.textMid, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended Investor Strategy</Text>
              <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginTop: 2 }}>{topExit.key}</Text>
            </View>
            <View style={{ backgroundColor: topExit.color, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.white }}>{topExit.score}</Text>
              <Text style={{ fontSize: 6, color: C.white }}>{topExit.score >= 70 ? 'Strong' : topExit.score >= 55 ? 'Good' : topExit.score >= 40 ? 'Fair' : 'Weak'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {investorExits.map((strat, i) => (
              <View key={strat.key} style={{ flex: 1, borderRadius: 4, padding: 7, borderWidth: 1.5, borderColor: i === 0 ? strat.color : C.border, backgroundColor: i === 0 ? C.navyMid : C.white }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: i === 0 ? C.white : C.text, flex: 1 }}>{strat.key}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: strat.color }}>{strat.score}</Text>
                </View>
                <Text style={{ fontSize: 7, color: i === 0 ? C.slate : C.textMid }}>#{i + 1} ranked</Text>
              </View>
            ))}
          </View>
          {aiAnalysis?.exitAnalysis && (
            <Text style={{ fontSize: 8, color: C.textMid, lineHeight: 1.5, marginTop: 8 }}>{aiAnalysis.exitAnalysis}</Text>
          )}
        </View>

        {/* Market Grade + Local Area */}
        {aiAnalysis?.marketGrade && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Market Grade — {input.city}, {input.state} {input.zip}</Text>

            {/* Overall letter + sub-grades */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'stretch' }} wrap={false}>
              <View style={{ width: 76, backgroundColor: C.navyMid, borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderWidth: 2, borderColor: gradeHex(aiAnalysis.marketGrade.overall) }}>
                <Text style={{ fontSize: 7, color: C.slate, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Overall</Text>
                <Text style={{ fontSize: 32, fontFamily: 'Helvetica-Bold', color: gradeHex(aiAnalysis.marketGrade.overall) }}>{aiAnalysis.marketGrade.overall}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { label: 'Market Conditions', grade: aiAnalysis.marketGrade.marketConditions },
                    { label: 'Local Market',      grade: aiAnalysis.marketGrade.localMarket },
                    { label: 'Population Trend',  grade: aiAnalysis.marketGrade.populationTrend },
                  ].map(item => (
                    <View key={item.label} style={{ flex: 1, backgroundColor: C.bgLight, borderRadius: 4, padding: 6, alignItems: 'center' }}>
                      <Text style={{ fontSize: 7, color: C.textMid, marginBottom: 2, textAlign: 'center' }}>{item.label}</Text>
                      <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: gradeHex(item.grade) }}>{item.grade}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { label: 'Rent Growth',    grade: aiAnalysis.marketGrade.rentGrowth },
                    { label: 'Supply/Demand', grade: aiAnalysis.marketGrade.supplyDemand },
                  ].map(item => (
                    <View key={item.label} style={{ flex: 1, backgroundColor: C.bgLight, borderRadius: 4, padding: 6, alignItems: 'center' }}>
                      <Text style={{ fontSize: 7, color: C.textMid, marginBottom: 2, textAlign: 'center' }}>{item.label}</Text>
                      <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: gradeHex(item.grade) }}>{item.grade}</Text>
                    </View>
                  ))}
                  {marketRent > 0 && (
                    <View style={{ flex: 1, backgroundColor: C.bgLight, borderRadius: 4, padding: 6, alignItems: 'center' }}>
                      <Text style={{ fontSize: 7, color: C.textMid, marginBottom: 2 }}>Market Rent</Text>
                      <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.text }}>{cur(marketRent)}</Text>
                      <Text style={{ fontSize: 7, color: C.slate }}>per month</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Grade summary */}
            <Text style={{ fontSize: 8.5, color: C.textMid, lineHeight: 1.6, marginBottom: 8 }}>{aiAnalysis.marketGrade.summary}</Text>

            {/* Bull & Bear columns */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }} wrap={false}>
              {aiAnalysis.marketGrade.bullPoints.length > 0 && (
                <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 4, padding: 8, borderWidth: 1, borderColor: '#86efac' }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.green, marginBottom: 5, textTransform: 'uppercase' }}>Market Strengths</Text>
                  {aiAnalysis.marketGrade.bullPoints.map((p, i) => (
                    <View key={i} style={s.bullet}>
                      <Text style={{ ...s.bulletDot, color: C.green }}>↑</Text>
                      <Text style={s.bulletTx}>{p}</Text>
                    </View>
                  ))}
                </View>
              )}
              {aiAnalysis.marketGrade.bearPoints.length > 0 && (
                <View style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 4, padding: 8, borderWidth: 1, borderColor: '#fca5a5' }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.red, marginBottom: 5, textTransform: 'uppercase' }}>Market Risks</Text>
                  {aiAnalysis.marketGrade.bearPoints.map((p, i) => (
                    <View key={i} style={s.bullet}>
                      <Text style={{ ...s.bulletDot, color: C.red }}>↓</Text>
                      <Text style={s.bulletTx}>{p}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Local Market Snapshot — derived from comps */}
            {compsToShow.length > 0 && (() => {
              const avgPrice = Math.round(compsToShow.reduce((sum, c) => sum + c.salePrice, 0) / compsToShow.length)
              const avgPsf   = Math.round(compsToShow.reduce((sum, c) => sum + c.pricePerSqft, 0) / compsToShow.length)
              const domComps  = compsToShow.filter(c => c.daysOnMarket != null)
              const avgDOM   = domComps.length > 0 ? Math.round(domComps.reduce((sum, c) => sum + (c.daysOnMarket ?? 0), 0) / domComps.length) : null
              const rentRatio = marketRent > 0 && purchasePrice > 0 ? (marketRent * 12) / purchasePrice : null
              return (
                <View>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    Local Market Snapshot ({compsToShow.length} recent sales)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{ ...s.statBox, flex: 1 }}>
                      <Text style={s.statLabel}>Avg Sold Price</Text>
                      <Text style={{ ...s.statValue, fontSize: 10 }}>{cur(avgPrice)}</Text>
                    </View>
                    <View style={{ ...s.statBox, flex: 1 }}>
                      <Text style={s.statLabel}>Avg $/sqft</Text>
                      <Text style={{ ...s.statValue, fontSize: 10 }}>${avgPsf}</Text>
                    </View>
                    {avgDOM != null && (
                      <View style={{ ...s.statBox, flex: 1 }}>
                        <Text style={s.statLabel}>Avg Days on Market</Text>
                        <Text style={{ ...s.statValue, fontSize: 10 }}>{avgDOM} days</Text>
                        <Text style={s.statSub}>{avgDOM < 20 ? 'Hot market' : avgDOM < 45 ? 'Balanced' : 'Buyer-friendly'}</Text>
                      </View>
                    )}
                    {rentRatio != null && (
                      <View style={{ ...s.statBox, flex: 1 }}>
                        <Text style={s.statLabel}>Gross Rent Yield</Text>
                        <Text style={{ ...s.statValue, fontSize: 10 }}>{pct(rentRatio)}</Text>
                        <Text style={s.statSub}>annual rent ÷ price</Text>
                      </View>
                    )}
                    <View style={{ ...s.statBox, flex: 1 }}>
                      <Text style={s.statLabel}>Comps Used</Text>
                      <Text style={{ ...s.statValue, fontSize: 10 }}>{compsToShow.length}</Text>
                      <Text style={s.statSub}>within {Math.max(...compsToShow.map(c => c.distance)).toFixed(1)} mi</Text>
                    </View>
                  </View>
                </View>
              )
            })()}
          </View>
        )}

        {/* Disclaimer */}
        <View style={{ marginTop: 16, padding: 10, backgroundColor: C.bgLight, borderRadius: 4 }}>
          <Text style={{ fontSize: 7, color: C.slate, lineHeight: 1.5 }}>
            DISCLAIMER: This report is for informational purposes only and does not constitute financial, legal, or investment advice.
            All projections are estimates based on available market data and are subject to change. Verify all information independently
            before making investment decisions. Past performance does not guarantee future results.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{company.name} · {company.phone} · {company.email}</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

    </Document>
  )
}
