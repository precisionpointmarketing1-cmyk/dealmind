import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { AnalysisResult, SaleComp } from '@/types/deal'
import { CompanySettings } from '@/types/company'
import { DEFAULTS } from '@/lib/utils/constants'

interface Props {
  result: AnalysisResult
  company: CompanySettings
  selectedComps?: SaleComp[]
  selectedARV?: number
  addedRepairItems?: { description: string; cost: number }[]
}

// Page-level padding handles header/footer clearance on every page
const HEADER_H   = 60
const ACCENT_H   = 3
const HEADER_TOT = HEADER_H + ACCENT_H

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
function scoreLabel(n: number) { return n >= 70 ? 'Strong' : n >= 55 ? 'Good' : n >= 40 ? 'Fair' : 'Weak' }

export function AcquisitionsReport({ result, company, selectedComps, selectedARV, addedRepairItems }: Props) {
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
    purple:  '#8b5cf6',
    bgLight: '#f8fafc',
    border:  '#e2e8f0',
    text:    '#1e293b',
    textMid: '#475569',
  }

  const s = StyleSheet.create({
    page: {
      backgroundColor: C.white,
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: C.text,
      paddingTop: 36,
      paddingBottom: 60,
      paddingHorizontal: 36,
    },
    // Clean white header — same template as InvestorReport
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: 18, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: C.cyan,
    },
    logo:   { width: 90, height: 36, objectFit: 'contain' },
    footer: { position: 'absolute', bottom: 14, left: 36, right: 36, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
    footerTx: { fontSize: 8, color: C.slate },

    sectionHead: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.navyMid, marginBottom: 7, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.border, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14 },

    statBox:   { backgroundColor: C.bgLight, borderRadius: 4, padding: 9, flex: 1 },
    statLabel: { fontSize: 8, color: C.textMid, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
    statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.text },
    statSub:   { fontSize: 8, color: C.slate, marginTop: 1 },

    tableHead:   { flexDirection: 'row', backgroundColor: C.navyMid, borderRadius: 3, paddingVertical: 6, paddingHorizontal: 6, marginBottom: 2 },
    tableHeadTx: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.cyan },
    tableRow:    { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.border },
    tableTx:     { fontSize: 9, color: C.text },
    tableHigh:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text },

    bullet:    { flexDirection: 'row', marginBottom: 3 },
    bulletDot: { fontSize: 9, color: C.cyan, marginRight: 5, marginTop: 0.5 },
    bulletTx:  { fontSize: 9, color: C.textMid, flex: 1, lineHeight: 1.5 },
  })

  const { input, coreMetrics: m, wholesale, subjectTo, arv, aiAnalysis, rentComps, saleComps } = result
  const brrrr       = (result as any).brrrr
  const privateMoney = (result as any).privateMoney
  const airbnb      = result.airbnb

  // Fallback tips — always show playbook even if AI hasn't run
  const FALLBACK_TIPS = [
    `Ask "What's making you think about selling now?" before any price talk. Let them tell you the real why — divorce, probate, tired landlord, financial stress. The pain is the leverage.`,
    `Never argue about price. Reframe around condition, timeline, and certainty. "If I could close in 2 weeks, cash, as-is — would that have any value to you?"`,
    `Use the repair walkthrough as your price reduction tool. Present it as neutral third-party facts: "The roof, HVAC, and plumbing together run ${cur(input.estimatedRepairs)} — that has to come off the top. That's not my number, that's contractor math."`,
    `Anchor your opening offer below MAO so you have room to come up as a concession. Make your first counter feel like a win for them, not a ceiling for you.`,
    `End every call with a micro-commitment: "Can I follow up Thursday once you've had time to think it over?" Never leave without a specific next step and a specific date.`,
  ]
  const negTips: string[] = (aiAnalysis?.negotiationTips && aiAnalysis.negotiationTips.length > 0)
    ? aiAnalysis.negotiationTips
    : FALLBACK_TIPS

  const effectiveARV  = selectedARV && selectedARV > 0 ? selectedARV : arv.adjustedARV
  const effectiveMAO  = Math.round(effectiveARV * DEFAULTS.INVESTOR_DISCOUNT - (input.estimatedRepairs ?? 0))

  const compsToShow = (
    selectedComps && selectedComps.length > 0
      ? selectedComps
      : (saleComps?.comparables ?? [])
  ).slice(0, 20)

  const marketRent    = rentComps?.rentAvg ?? 0
  const mao           = effectiveMAO                                    // max price — deal still works
  const askingPrice   = input.askingPrice > 0 ? input.askingPrice : 0  // seller's ask (may be 0 if not entered)
  const maoGap        = askingPrice > 0 ? mao - askingPrice : null     // positive = seller under MAO (room); negative = over MAO
  const equityAtMAO   = effectiveARV - mao - input.estimatedRepairs    // equity if acquired AT the MAO
  const assignmentFee = (input.assignmentFee && input.assignmentFee > 0) ? input.assignmentFee : 0
  const dateStr       = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Listing alternative calc — seller must repair house to ARV condition before listing
  const listPrice    = Math.round(effectiveARV * 0.97)
  const listComm     = Math.round(listPrice * 0.055)
  const listClose    = Math.round(listPrice * 0.01)
  const listRepairs  = input.estimatedRepairs ?? 0    // cost seller bears to bring house to list condition
  const listNet      = listPrice - listComm - listClose - listRepairs
  const listGap      = askingPrice > 0 ? listNet - askingPrice : listNet - mao

  // Top acquisition strategy
  const listingScore = listGap <= 0 ? 88 : listGap <= 15_000 ? 68 : listGap <= 35_000 ? 45 : listGap <= 60_000 ? 25 : 12
  const acqStrategies = [
    { key: 'Cash Offer / Wholesale', score: wholesale.dealScore,  color: scoreColor(wholesale.dealScore) },
    { key: 'Subject-To',             score: subjectTo.dealScore,  color: scoreColor(subjectTo.dealScore) },
    { key: 'Traditional Listing',    score: listingScore,         color: scoreColor(listingScore) },
  ].sort((a, b) => b.score - a.score)

  const topAcq = acqStrategies[0]

  // AI recommended investor exit
  const investorStrategies = [
    { key: 'BRRRR',            score: brrrr?.dealScore ?? 0 },
    { key: 'DSCR / Buy & Hold', score: airbnb?.dealScore ?? 0 },
    { key: 'Fix & Flip',        score: wholesale.dealScore },
    { key: 'Private Money',     score: privateMoney?.dealScore ?? 0 },
  ].sort((a, b) => b.score - a.score)

  const topInvestor = investorStrategies[0]

  const soldComps = compsToShow.slice(0, 8)

  return (
    <Document>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 1 — Acquisition Summary
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
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.navyMid }}>ACQUISITIONS REPORT</Text>
            <Text style={{ fontSize: 8, color: C.textMid, marginTop: 2 }}>{dateStr}</Text>
            {company.agentName && <Text style={{ fontSize: 8, color: C.textMid }}>Prepared by: {company.agentName}</Text>}
          </View>
        </View>

        {/* Property address bar */}
        <View style={{ backgroundColor: C.navyMid, borderRadius: 4, padding: 10, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white }}>{input.address}, {input.city}, {input.state} {input.zip}</Text>
          <Text style={{ fontSize: 8, color: C.slate, marginTop: 2 }}>
            {input.propertyType.replace(/-/g, ' ')} · {input.bedrooms}bd/{input.bathrooms}ba · {(input.sqft ?? 0).toLocaleString()} sqft · Built {input.yearBuilt}
          </Text>
        </View>

        {/* Hero row: MAO + deal stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>

          {/* MAO hero — the number that matters */}
          <View style={{ flex: 1.4, backgroundColor: C.navyMid, borderRadius: 5, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.cyan }}>
            <Text style={{ fontSize: 7, color: C.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>Max Acquisition Price</Text>
            <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.white }}>{cur(mao)}</Text>
            <Text style={{ fontSize: 7, color: C.slate, marginTop: 3, textAlign: 'center' }}>Do not exceed — deal viable at this price</Text>
            {/* Suggested opening offer */}
            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.25)', width: '100%', alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: C.slate }}>Suggested Opening Offer</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.cyan, marginTop: 1 }}>{cur(wholesale.suggestedOfferPrice)}</Text>
              <Text style={{ fontSize: 6, color: C.slate, marginTop: 1 }}>Start 5% below MAO — room to negotiate up</Text>
            </View>
            {assignmentFee > 0 && (
              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.25)', width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 7, color: C.slate }}>Assignment Fee</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.cyan, marginTop: 1 }}>{cur(assignmentFee)}</Text>
              </View>
            )}
          </View>

          {/* Key deal numbers */}
          <View style={{ flex: 2, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={s.statBox}>
                <Text style={s.statLabel}>{selectedARV && selectedARV > 0 ? 'Comps-Adjusted ARV' : 'Consensus ARV'}</Text>
                <Text style={s.statValue}>{cur(effectiveARV)}</Text>
                <Text style={s.statSub}>{selectedARV && selectedARV > 0 ? 'from selected comps' : `${arv.compsUsed} comps · ${arv.confidence} conf.`}</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statLabel}>Repair Budget</Text>
                <Text style={s.statValue}>{cur(input.estimatedRepairs)}</Text>
                <Text style={s.statSub}>As entered / AI photo est.</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statLabel}>Equity at MAO</Text>
                <Text style={{ ...s.statValue, color: equityAtMAO > 0 ? C.green : C.red }}>{cur(equityAtMAO)}</Text>
                <Text style={s.statSub}>ARV − MAO − repairs</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {/* Seller asking — shown only if entered, as context gap */}
              {askingPrice > 0 ? (
                <View style={{ ...s.statBox, borderWidth: 1, borderColor: maoGap != null && maoGap >= 0 ? C.green : C.red }}>
                  <Text style={s.statLabel}>Seller Asking</Text>
                  <Text style={{ ...s.statValue, color: maoGap != null && maoGap >= 0 ? C.green : C.red }}>{cur(askingPrice)}</Text>
                  <Text style={{ ...s.statSub, color: maoGap != null && maoGap >= 0 ? C.green : C.red }}>
                    {maoGap != null && maoGap >= 0
                      ? `✓ ${cur(maoGap)} below MAO`
                      : maoGap != null ? `✗ ${cur(-maoGap)} over MAO` : ''}
                  </Text>
                </View>
              ) : (
                <View style={s.statBox}>
                  <Text style={s.statLabel}>Seller Asking</Text>
                  <Text style={{ ...s.statValue, color: C.slate }}>—</Text>
                  <Text style={s.statSub}>Not yet entered</Text>
                </View>
              )}
              <View style={s.statBox}>
                <Text style={s.statLabel}>Market Rent</Text>
                <Text style={s.statValue}>{marketRent > 0 ? cur(marketRent) + '/mo' : '—'}</Text>
                <Text style={s.statSub}>RentCast estimate</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statLabel}>Monthly Cash Flow</Text>
                <Text style={{ ...s.statValue, color: m.monthlyCashFlow >= 0 ? C.text : C.red }}>{cur(m.monthlyCashFlow)}/mo</Text>
                <Text style={s.statSub}>Cap {pct(m.capRate)} · DSCR {m.dscr.toFixed(2)}x</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── AI-added repair items ── */}
        {addedRepairItems && addedRepairItems.length > 0 && (
          <View style={{ marginBottom: 10 }} wrap={false}>
            <Text style={s.sectionHead}>Additional Repair Items</Text>
            {addedRepairItems.map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: i % 2 === 0 ? C.bgLight : C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ fontSize: 9, color: C.text, flex: 1 }}>{item.description}</Text>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>{cur(item.cost)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: '#fef9c3', borderTopWidth: 1.5, borderTopColor: C.yellow }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>Additional Items Total</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.text }}>{cur(addedRepairItems.reduce((s, i) => s + i.cost, 0))}</Text>
            </View>
          </View>
        )}

        {/* ── AI Acquisition Recommendation ── */}
        {/* Verdict banner */}
        <View style={{ backgroundColor: C.navy, borderRadius: 6, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Score circle */}
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: topAcq.color, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
            <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.white }}>{topAcq.score}</Text>
          </View>
          {/* Text block */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, color: C.slate, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
              AI Recommendation · {aiAnalysis?.aiConfidence ? `${aiAnalysis.aiConfidence}% confidence` : 'Quantitative Scoring'}
            </Text>
            <Text style={{ fontSize: 17, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 2 }}>{topAcq.key}</Text>
            <Text style={{ fontSize: 7.5, color: C.slate }}>{scoreLabel(topAcq.score)} · #{1} of {acqStrategies.length} acquisition paths scored</Text>
          </View>
        </View>

        {/* AI acquisition analysis text */}
        {(aiAnalysis?.acquisitionAnalysis || aiAnalysis?.dealSummary) && (
          <View style={{ backgroundColor: C.bgLight, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: topAcq.color }}>
            <Text style={{ fontSize: 8.5, color: C.text, lineHeight: 1.65 }}>
              {aiAnalysis.acquisitionAnalysis ?? aiAnalysis.dealSummary}
            </Text>
          </View>
        )}

        {/* Ranked comparison — horizontal score bars, not cards */}
        <View style={{ gap: 5, marginBottom: 14 }}>
          {acqStrategies.map((strat, i) => (
            <View key={strat.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: i === 0 ? '#f0fdf4' : C.bgLight, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: i === 0 ? strat.color : C.border }}>
              <Text style={{ fontSize: 7, color: C.textMid, width: 14 }}>#{i + 1}</Text>
              <Text style={{ fontSize: 9, fontFamily: i === 0 ? 'Helvetica-Bold' : 'Helvetica', color: i === 0 ? C.text : C.textMid, flex: 1 }}>{strat.key}</Text>
              {/* Score bar */}
              <View style={{ width: 80, height: 5, backgroundColor: C.border, borderRadius: 3 }}>
                <View style={{ width: `${strat.score}%`, height: 5, backgroundColor: strat.color, borderRadius: 3 }} />
              </View>
              <View style={{ backgroundColor: strat.color, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white }}>{strat.score}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{company.name} · {company.phone} · {company.email}</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 2 — Deal Structure Detail
      ═══════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            {company.logoBase64
              ? <Image src={company.logoBase64} style={s.logo} />
              : <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.cyan }}>{company.name}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.navyMid }}>ACQUISITIONS REPORT</Text>
            <Text style={{ fontSize: 8, color: C.textMid, marginTop: 2 }}>{dateStr}</Text>
          </View>
        </View>

        {/* ── DEAL TYPE TAB: Cash Offer / Wholesale ── */}
        <View style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.cyan }}>
          {/* Tab header band */}
          <View style={{ backgroundColor: C.navyMid, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 7, color: C.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' }}>Deal Type 01</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, marginTop: 2 }}>Cash Offer / Wholesale</Text>
            </View>
            <View style={{ backgroundColor: scoreColor(wholesale.dealScore), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', minWidth: 48 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white }}>{wholesale.dealScore}</Text>
              <Text style={{ fontSize: 6, color: C.white, textAlign: 'center' }}>{scoreLabel(wholesale.dealScore)}</Text>
            </View>
          </View>
          {/* Stats */}
          <View style={{ backgroundColor: C.bgLight, padding: 10, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: 'MAO (70% Rule)',       value: cur(wholesale.mao),                    hi: true },
                { label: 'Suggested Offer',      value: cur(wholesale.suggestedOfferPrice),    hi: true },
                { label: 'Assignment Fee',       value: cur(wholesale.wholesaleFee),           hi: wholesale.wholesaleFee > 0 },
                { label: 'End Buyer Price',      value: cur(wholesale.endBuyerPrice),          hi: true },
                { label: 'End Buyer Equity',     value: cur(wholesale.endBuyerEquity),         hi: wholesale.endBuyerEquity > 30_000 },
                { label: 'End Buyer ROI',        value: pct(wholesale.endBuyerROI),            hi: wholesale.endBuyerROI > 0.10 },
              ].map(item => (
                <View key={item.label} style={{ flex: 1, backgroundColor: C.white, borderRadius: 4, padding: 7, borderTopWidth: 2, borderTopColor: item.hi ? C.cyan : C.border }}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text }}>{item.value}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: 'Earnest Money (EMD)',  value: cur(wholesale.estimatedEMD) },
                { label: 'ROI on EMD',           value: `${wholesale.roiOnEMD.toFixed(1)}x`,  hi: wholesale.roiOnEMD > 5 },
                { label: 'Eligible',             value: wholesale.eligible ? '✓ Yes' : '✗ No', hi: wholesale.eligible },
              ].map(item => (
                <View key={item.label} style={{ flex: 1, backgroundColor: C.white, borderRadius: 4, padding: 7 }}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: (item as any).hi ? C.green : C.text }}>{item.value}</Text>
                </View>
              ))}
              {wholesale.notes?.slice(0, 1).map((n: string, i: number) => (
                <View key={i} style={{ flex: 3, backgroundColor: '#f0f9ff', borderRadius: 4, padding: 7, borderLeftWidth: 2, borderLeftColor: C.cyan }}>
                  <Text style={{ fontSize: 8, color: C.textMid, lineHeight: 1.5 }}>{n}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── DEAL TYPE TAB: Subject-To ── */}
        <View style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.purple }}>
          <View style={{ backgroundColor: C.navyMid, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 7, color: C.purple, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' }}>Deal Type 02</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, marginTop: 2 }}>Subject-To (Take Over Payments)</Text>
            </View>
            <View style={{ backgroundColor: scoreColor(subjectTo.dealScore), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', minWidth: 48 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white }}>{subjectTo.dealScore}</Text>
              <Text style={{ fontSize: 6, color: C.white }}>{scoreLabel(subjectTo.dealScore)}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: C.bgLight, padding: 10, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {subjectTo.existingLoanBalance > 0 ? [
                { label: 'Entry Fee to Seller',  value: cur(subjectTo.entryFee) },
                { label: 'Existing Loan Bal.',   value: cur(subjectTo.existingLoanBalance) },
                { label: 'Existing Rate',        value: subjectTo.existingRate > 0 ? pct(subjectTo.existingRate) : '—' },
                { label: 'Existing PITI',        value: `${cur(subjectTo.existingMonthlyPITI)}/mo` },
                { label: 'Cash to Close',        value: cur(subjectTo.totalCashToClose) },
                { label: 'Equity Capture',       value: cur(subjectTo.equityCapture) },
              ].map(item => (
                <View key={item.label} style={{ flex: 1, backgroundColor: C.white, borderRadius: 4, padding: 7, borderTopWidth: 2, borderTopColor: C.purple }}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text }}>{item.value}</Text>
                </View>
              )) : (
                <View style={{ flex: 1, backgroundColor: '#fff7ed', borderRadius: 4, padding: 10, borderLeftWidth: 2, borderLeftColor: C.yellow }}>
                  <Text style={{ fontSize: 8, color: '#92400e', fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Loan data not entered</Text>
                  <Text style={{ fontSize: 8, color: C.textMid, lineHeight: 1.4 }}>Request seller's mortgage statement to evaluate Subject-To. Enter existing loan balance and PITI in deal inputs.</Text>
                </View>
              )}
            </View>
            {subjectTo.existingLoanBalance > 0 && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[
                  { label: 'CF Unfinanced',  value: `${cur(subjectTo.cashFlowUnfinanced)}/mo`,  hi: subjectTo.cashFlowUnfinanced > 0 },
                  { label: 'CF w/ Priv. $',  value: `${cur(subjectTo.cashFlowFinanced)}/mo`,    hi: subjectTo.cashFlowFinanced > 0 },
                  { label: 'Rate Savings',   value: subjectTo.rateSavingsMonthly > 0 ? `${cur(subjectTo.rateSavingsMonthly)}/mo` : '—' },
                  { label: 'Wrap Spread',    value: subjectTo.wrapPaymentSpread > 0 ? `${cur(subjectTo.wrapPaymentSpread)}/mo` : '—' },
                ].map(item => (
                  <View key={item.label} style={{ flex: 1, backgroundColor: C.white, borderRadius: 4, padding: 7 }}>
                    <Text style={s.statLabel}>{item.label}</Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: (item as any).hi ? C.green : C.text }}>{item.value}</Text>
                  </View>
                ))}
                {subjectTo.notes?.slice(0, 1).map((n: string, i: number) => (
                  <View key={i} style={{ flex: 3, backgroundColor: '#f5f3ff', borderRadius: 4, padding: 7, borderLeftWidth: 2, borderLeftColor: C.purple }}>
                    <Text style={{ fontSize: 8, color: C.textMid, lineHeight: 1.5 }}>{n}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── DEAL TYPE TAB: Traditional Listing ── */}
        <View style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.green }}>
          <View style={{ backgroundColor: C.navyMid, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 7, color: C.green, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' }}>Deal Type 03</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, marginTop: 2 }}>Traditional MLS Listing</Text>
            </View>
            <View style={{ backgroundColor: scoreColor(listingScore), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', minWidth: 48 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white }}>{listingScore}</Text>
              <Text style={{ fontSize: 6, color: C.white }}>{scoreLabel(listingScore)}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: C.bgLight, padding: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: 'Suggested List Price',    value: cur(listPrice),                    color: C.text },
                { label: 'Repairs Before Listing',  value: listRepairs > 0 ? `(${cur(listRepairs)})` : 'None entered', color: listRepairs > 0 ? C.red : C.slate },
                { label: 'Agent Commission (5.5%)', value: `(${cur(listComm)})`,              color: C.red },
                { label: 'Closing Costs',           value: `(${cur(listClose)})`,             color: C.red },
                { label: 'Net to Seller',           value: cur(listNet),                      color: listNet > mao ? C.text : C.red },
                { label: 'Your MAO (Cash Offer)',   value: cur(mao),                          color: C.cyan },
                { label: 'Cash vs. Listing',        value: listGap >= 0 ? `Listing +${cur(listGap)}` : `Cash saves ${cur(Math.abs(listGap))}`, color: listGap < 0 ? C.green : C.red },
              ].map(item => (
                <View key={item.label} style={{ flex: 1, backgroundColor: C.white, borderRadius: 4, padding: 7, borderTopWidth: 2, borderTopColor: item.color === C.slate ? C.border : item.color }}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: item.color }}>{item.value}</Text>
                </View>
              ))}
            </View>
            {listRepairs > 0 && (
              <View style={{ marginTop: 7, backgroundColor: '#fff7ed', borderRadius: 4, padding: 8, borderLeftWidth: 2, borderLeftColor: C.yellow }}>
                <Text style={{ fontSize: 8, color: '#92400e', lineHeight: 1.5 }}>
                  To list at ARV ({cur(effectiveARV)}), seller must first invest {cur(listRepairs)} in repairs/updates. Net-to-seller reflects this cost. A cash offer avoids all repair burden.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Seller Profile ── */}
        {aiAnalysis?.sellerProfile && (
          <View style={{ backgroundColor: '#faf5ff', borderRadius: 5, padding: 10, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: C.purple }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.purple, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Seller Profile</Text>
            <Text style={{ fontSize: 9, color: C.textMid, lineHeight: 1.6 }}>{aiAnalysis.sellerProfile}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{company.name} · {company.phone} · {company.email}</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 3 — Comps + Deal Structure Matrix
      ═══════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            {company.logoBase64
              ? <Image src={company.logoBase64} style={s.logo} />
              : <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.cyan }}>{company.name}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.navyMid }}>ACQUISITIONS REPORT</Text>
            <Text style={{ fontSize: 8, color: C.textMid, marginTop: 2 }}>{dateStr}</Text>
          </View>
        </View>

        {/* ── AI Acquisition Recommendation Summary ── */}
        <Text style={s.sectionHead}>AI Acquisition Recommendation</Text>

        {/* Hero — recommended strategy */}
        <View style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: C.cyan }}>
          <View style={{ backgroundColor: C.navyMid, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 7, color: C.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' }}>AI Recommended Acquisition Method</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.white, marginTop: 2 }}>{topAcq.key}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <View style={{ backgroundColor: scoreColor(topAcq.score), borderRadius: 24, width: 52, height: 52, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white }}>{topAcq.score}</Text>
              </View>
              <Text style={{ fontSize: 7, color: C.slate, marginTop: 3 }}>{scoreLabel(topAcq.score)}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: C.bgLight, paddingHorizontal: 14, paddingVertical: 10 }}>
            {aiAnalysis?.acquisitionAnalysis ? (
              <Text style={{ fontSize: 9.5, color: C.text, lineHeight: 1.65 }}>{aiAnalysis.acquisitionAnalysis}</Text>
            ) : (
              <Text style={{ fontSize: 9, color: C.textMid }}>Based on deal financials, {topAcq.key} scores highest at {topAcq.score}/100.</Text>
            )}
          </View>
        </View>

        {/* All 3 acquisition methods ranked */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {acqStrategies.map((strat, i) => (
            <View key={strat.key} style={{ flex: 1, borderRadius: 5, overflow: 'hidden', borderWidth: 1.5, borderColor: i === 0 ? strat.color : C.border }}>
              <View style={{ backgroundColor: i === 0 ? C.navyMid : '#f1f5f9', paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 3, borderTopColor: strat.color }}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: i === 0 ? C.white : C.text, flex: 1 }}>{strat.key}</Text>
                <View style={{ backgroundColor: scoreColor(strat.score), borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.white }}>{strat.score}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: i === 0 ? C.navyLt : C.white, padding: 8 }}>
                <Text style={{ fontSize: 7, color: i === 0 ? C.slate : C.textMid }}>
                  #{i + 1} ranked · {scoreLabel(strat.score)}
                </Text>
                {i === 0 && (
                  <Text style={{ fontSize: 7, color: C.cyan, marginTop: 3 }}>← Recommended</Text>
                )}
                {i === 1 && strat.key === 'Subject-To' && subjectTo.existingLoanBalance > 0 && (
                  <Text style={{ fontSize: 7, color: C.textMid, marginTop: 3 }}>
                    {cur(subjectTo.totalCashToClose)} to close · {cur(subjectTo.cashFlowWithSubTo)}/mo CF
                  </Text>
                )}
                {i === 1 && strat.key === 'Cash Offer / Wholesale' && (
                  <Text style={{ fontSize: 7, color: C.textMid, marginTop: 3 }}>
                    MAO {cur(mao)} · Fee {cur(wholesale.wholesaleFee)}
                  </Text>
                )}
                {i === 2 && strat.key === 'Traditional Listing' && (
                  <Text style={{ fontSize: 7, color: C.textMid, marginTop: 3 }}>
                    Net {cur(listNet)} after costs
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* AI Seller + Market context */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {aiAnalysis?.sellerProfile && (
            <View style={{ flex: 1, backgroundColor: '#faf5ff', borderRadius: 5, padding: 10, borderTopWidth: 2, borderTopColor: C.purple }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.purple, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Seller Profile</Text>
              <Text style={{ fontSize: 8.5, color: C.textMid, lineHeight: 1.6 }}>{aiAnalysis.sellerProfile}</Text>
            </View>
          )}
          {aiAnalysis?.marketAnalysis && (
            <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 5, padding: 10, borderTopWidth: 2, borderTopColor: C.green }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.green, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Market Context</Text>
              <Text style={{ fontSize: 8.5, color: C.textMid, lineHeight: 1.6 }}>{aiAnalysis.marketAnalysis}</Text>
            </View>
          )}
        </View>

        {/* ── Seller Approach Playbook ── */}
        <View style={{ marginTop: 18 }}>
          {/* Section divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 }}>
            <View style={{ flex: 1, height: 1.5, backgroundColor: C.blue }} />
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.blue, letterSpacing: 1, textTransform: 'uppercase' }}>Seller Approach Playbook</Text>
            <View style={{ flex: 1, height: 1.5, backgroundColor: C.blue }} />
          </View>
          <View style={{ backgroundColor: '#f0f7ff', borderRadius: 4, padding: 7, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: C.blue }}>
            <Text style={{ fontSize: 8, color: C.textMid }}>
              {input.address}, {input.city} · Asking: {askingPrice > 0 ? cur(askingPrice) : 'not disclosed'} · MAO: {cur(mao)} · Gap: {askingPrice > 0 ? `${askingPrice > mao ? cur(askingPrice - mao) + ' over — bring them down' : cur(mao - askingPrice) + ' under — deal in the money'} MAO` : 'N/A'}
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {negTips.slice(0, 5).map((t: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.bgLight, borderRadius: 4, padding: 10, borderLeftWidth: 3, borderLeftColor: C.blue }}>
                <View style={{ backgroundColor: C.navy, borderRadius: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.white }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 10, color: C.navy, lineHeight: 1.7, flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Risks + Opportunities ── */}
        {(aiAnalysis?.keyRisks?.length || aiAnalysis?.keyOpportunities?.length) ? (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {aiAnalysis?.keyOpportunities && aiAnalysis.keyOpportunities.length > 0 && (
              <View style={{ flex: 1, backgroundColor: C.bgLight, borderRadius: 4, padding: 10, borderTopWidth: 2, borderTopColor: C.green }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.green, marginBottom: 5, textTransform: 'uppercase' }}>Opportunities</Text>
                {(aiAnalysis.keyOpportunities as string[]).slice(0, 4).map((o: string, i: number) => (
                  <View key={i} style={s.bullet}>
                    <Text style={{ ...s.bulletDot, color: C.green }}>✓</Text>
                    <Text style={{ ...s.bulletTx, fontSize: 9 }}>{o}</Text>
                  </View>
                ))}
              </View>
            )}
            {aiAnalysis?.keyRisks && aiAnalysis.keyRisks.length > 0 && (
              <View style={{ flex: 1, backgroundColor: C.bgLight, borderRadius: 4, padding: 10, borderTopWidth: 2, borderTopColor: C.yellow }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#d97706', marginBottom: 5, textTransform: 'uppercase' }}>Risks to Underwrite</Text>
                {(aiAnalysis.keyRisks as string[]).slice(0, 4).map((r: string, i: number) => (
                  <View key={i} style={s.bullet}>
                    <Text style={{ ...s.bulletDot, color: C.yellow }}>⚠</Text>
                    <Text style={{ ...s.bulletTx, fontSize: 9 }}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Market Analysis */}
        {aiAnalysis?.marketAnalysis && (
          <>
            <Text style={s.sectionHead}>Market Analysis</Text>
            <View style={{ backgroundColor: C.bgLight, borderRadius: 4, padding: 10, borderTopWidth: 2, borderTopColor: C.blue }}>
              <Text style={{ fontSize: 8, color: C.textMid, lineHeight: 1.5 }}>{aiAnalysis.marketAnalysis}</Text>
            </View>
          </>
        )}

        {/* Disclaimer */}
        <View style={{ marginTop: 14, padding: 8, backgroundColor: C.bgLight, borderRadius: 4 }}>
          <Text style={{ fontSize: 7, color: C.slate, lineHeight: 1.4 }}>
            DISCLAIMER: This acquisitions report is for internal use only. All projections are estimates based on available market data and are subject to change.
            Verify all information independently before making investment decisions.
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
