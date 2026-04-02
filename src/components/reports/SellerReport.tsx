import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { AnalysisResult, SaleComp } from '@/types/deal'
import { CompanySettings } from '@/types/company'

interface Props {
  result: AnalysisResult
  company: CompanySettings
  selectedComps?: SaleComp[]
  selectedARV?: number
  ourOffer?: number
  sessionPhotos?: string[]
  addedRepairItems?: { description: string; cost: number }[]
}

// Header height constants — must match the actual rendered header so body padding is correct
const HEADER_H   = 72   // headerBand paddingVertical 20*2 + logo ~32
const ACCENT_H   = 4
const HEADER_TOT = HEADER_H + ACCENT_H  // total space reserved at top of each page

function cur(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function SellerReport({ result, company, selectedComps: _selectedComps, selectedARV, ourOffer, sessionPhotos, addedRepairItems }: Props) {
  const primary = company.primaryColor || '#00c8ff'
  const accent  = company.accentColor  || '#0066cc'

  const c = {
    navy:      '#0f1628',
    navyMid:   '#1e2d4a',
    cyan:      primary,
    green:     '#10b981',
    yellow:    '#f59e0b',
    red:       '#ef4444',
    gray:      '#6b7280',
    lightGray: '#f3f4f6',
    border:    '#e5e7eb',
    white:     '#ffffff',
    text:      '#111827',
  }

  const s = StyleSheet.create({
    page: {
      backgroundColor: c.white, fontFamily: 'Helvetica', fontSize: 10, color: c.text,
      paddingTop: 36,
      paddingBottom: 60,
      paddingHorizontal: 40,
    },

    // Clean white header — same template as InvestorReport
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: 20, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: c.cyan,
    },

    logo:    { width: 90, height: 36, objectFit: 'contain' },
    coName:  { fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.navy },
    coTag:   { fontSize: 8, color: c.gray, marginTop: 2 },
    coInfo:  { fontSize: 8, color: c.gray, marginTop: 1 },

    // Body — page-level padding already handles header/footer clearance
    body: {},

    // Section wrapper — wrap=false keeps heading + content together
    section: { marginBottom: 18 },
    sectionTitle: {
      fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.navy,
      marginBottom: 10, paddingBottom: 5,
      borderBottomWidth: 1.5, borderBottomColor: c.cyan,
    },

    // Address
    addrHero: {
      backgroundColor: c.lightGray, borderRadius: 6, padding: 14,
      borderLeftWidth: 4, borderLeftColor: c.cyan,
    },
    addrLabel: { fontSize: 7, color: c.gray, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 3 },
    addrText:  { fontSize: 15, fontFamily: 'Helvetica-Bold', color: c.navy },
    addrSub:   { fontSize: 8.5, color: c.gray, marginTop: 3 },

    // Cash offer
    offerRow: { flexDirection: 'row', gap: 12 },
    offerBox: {
      flex: 1.2, backgroundColor: c.navy, borderRadius: 6, padding: 18,
      alignItems: 'center', borderWidth: 1.5, borderColor: c.cyan,
    },
    offerLabel: { fontSize: 8, color: c.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, marginBottom: 5 },
    offerValue: { fontSize: 30, fontFamily: 'Helvetica-Bold', color: c.white },
    offerSub:   { fontSize: 8, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
    offerNote:  { backgroundColor: c.navyMid, borderRadius: 5, padding: 9, marginTop: 10, width: '100%' },
    offerNoteText: { fontSize: 8, color: '#94a3b8', lineHeight: 1.5, textAlign: 'center' },

    calcCol: { flex: 1, gap: 8 },
    calcBox: { backgroundColor: c.lightGray, borderRadius: 5, padding: 10 },
    calcLabel: { fontSize: 7, color: c.gray, marginBottom: 2 },
    calcValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: c.navy },
    calcSub:   { fontSize: 7, color: c.gray, marginTop: 1 },

    // Process steps
    stepGrid: { flexDirection: 'row', gap: 10 },
    stepCard: { flex: 1, backgroundColor: c.lightGray, borderRadius: 6, padding: 14 },
    stepBadge: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: c.cyan, justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    stepTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.navy, marginBottom: 4 },
    stepText:  { fontSize: 9, color: c.gray, lineHeight: 1.5 },

    // Benefits
    benefitsCard: { backgroundColor: c.lightGray, borderRadius: 6, padding: 14 },
    benefitRow:   { flexDirection: 'row', marginBottom: 7, alignItems: 'flex-start' },
    checkBadge:   {
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: c.green, justifyContent: 'center', alignItems: 'center',
      marginRight: 9, marginTop: 1, flexShrink: 0,
    },
    benefitText: { flex: 1, fontSize: 10, color: c.text, lineHeight: 1.5 },

    // Rehab table
    tHead:      { flexDirection: 'row', backgroundColor: c.navy, borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingHorizontal: 10, paddingVertical: 6 },
    tHeadCell:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: c.white },
    tRow:       { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
    tAlt:       { backgroundColor: '#fafafa' },
    tCell:      { fontSize: 8.5, color: c.text },
    tTotal:     {
      flexDirection: 'row', justifyContent: 'space-between',
      backgroundColor: '#fef3c7', borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
      paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1.5, borderTopColor: c.yellow,
    },

    // CTA
    ctaBox: { backgroundColor: c.navy, borderRadius: 8, padding: 20, borderWidth: 1.5, borderColor: c.cyan },
    ctaStat: {
      alignItems: 'center', backgroundColor: c.navyMid,
      borderRadius: 6, paddingVertical: 10, paddingHorizontal: 16, minWidth: 90,
    },

    // Footer
    footer: { position: 'absolute', bottom: 16, left: 40, right: 40, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
    footerTx:  { fontSize: 7.5, color: c.gray },
    disclaimer: { fontSize: 7, color: c.gray, marginTop: 4, lineHeight: 1.4, textAlign: 'center' },
  })

  void accent // accent available for future use; cyan maps to primary

  const { input, coreMetrics, rehabScan, aiAnalysis } = result
  const repairs  = input.estimatedRepairs
  const effectiveARV = selectedARV && selectedARV > 0 ? selectedARV : result.arv.adjustedARV
  const arv = result.arv
  // Use our custom offer if set (to negotiate lower); fall back to MAO
  const offerAmt = (ourOffer && ourOffer > 0) ? ourOffer : coreMetrics.mao
  const badCats  = (rehabScan?.categories ?? []).filter(cat => cat.condition !== 'good')

  // Savings comparison: what seller avoids vs. listing at ARV (not vs their ask)
  const listPrice  = Math.round(effectiveARV * 0.97)
  const agentComm  = Math.round(listPrice * 0.06)
  const closingCst = Math.round(listPrice * 0.02)
  const savings    = agentComm + closingCst + repairs

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Shared header rendered on every page — clean white, matching InvestorReport template
  const Header = () => (
    <View style={s.header}>
      <View>
        {company.logoBase64
          ? <Image src={company.logoBase64} style={s.logo} />
          : <Text style={s.coName}>{company.name}</Text>}
        {company.tagline ? <Text style={s.coTag}>{company.tagline}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {company.agentName ? <Text style={{ ...s.coInfo, fontFamily: 'Helvetica-Bold', fontSize: 10 }}>{company.agentName}</Text> : null}
        {company.phone   ? <Text style={s.coInfo}>{company.phone}</Text>   : null}
        {company.email   ? <Text style={s.coInfo}>{company.email}</Text>   : null}
        {company.website ? <Text style={s.coInfo}>{company.website}</Text> : null}
      </View>
    </View>
  )

  const Footer = () => (
    <View style={s.footer} fixed>
      <View style={s.footerRow}>
        <Text style={s.footerTx}>{company.name}</Text>
        <Text style={s.footerTx}>Confidential · {date}</Text>
        <Text style={s.footerTx}>{company.licenseNumber ? `Lic. ${company.licenseNumber}` : ' '}</Text>
      </View>
      <Text style={s.disclaimer}>
        This report is for informational purposes only. The cash offer is subject to a physical inspection and final due diligence.
        All estimates are based on publicly available data and AI-assisted analysis.
        {company.name} reserves the right to adjust the offer based on inspection findings.
      </Text>
    </View>
  )

  // ── Savings breakdown (positive framing: what the seller KEEPS) ────────────
  const savingsRows = [
    { label: 'Agent Commissions You Keep',   value: agentComm,  sub: '6% saved — no listing agent, no buyer agent' },
    { label: 'Repair Costs You Skip',        value: repairs,    sub: 'Sell as-is — we absorb every repair' },
    { label: 'Closing Costs You Avoid',      value: closingCst, sub: 'No seller concessions or surprise deductions' },
  ]

  return (
    <Document>

      {/* ─────────────────────────────── PAGE 1 — OFFER SUMMARY ──────────────── */}
      <Page size="LETTER" style={s.page}>
        <Header />
        <Footer />

        <View style={s.body}>

          {/* House photo — full width, above the address */}
          {sessionPhotos && sessionPhotos.length > 0 && (
            <View style={{ marginBottom: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden' }} wrap={false}>
              <Image src={sessionPhotos[0]} style={{ width: '100%', height: 170, objectFit: 'cover' }} />
            </View>
          )}

          {/* Address — dark strip directly below photo */}
          <View style={{
            backgroundColor: c.navy,
            borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
            ...(sessionPhotos?.length ? {} : { borderTopLeftRadius: 6, borderTopRightRadius: 6 }),
            paddingHorizontal: 14, paddingVertical: 10,
            marginBottom: 12,
            borderBottomWidth: 2, borderBottomColor: c.cyan,
          }} wrap={false}>
            <Text style={{ fontSize: 7, color: c.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 2 }}>CASH OFFER SUMMARY</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: c.white }}>{input.address}</Text>
            <Text style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
              {input.city}, {input.state} {input.zip}{'   ·   '}{input.bedrooms}bd / {input.bathrooms}ba{'   ·   '}{(input.sqft ?? 0).toLocaleString()} sqft{'   ·   '}{date}
            </Text>
          </View>

          {/* Cash Offer */}
          <View wrap={false} style={{ backgroundColor: c.navy, borderRadius: 6, paddingVertical: 16, paddingHorizontal: 20, borderWidth: 1.5, borderColor: c.cyan, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 8, color: c.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, marginBottom: 4 }}>YOUR CASH OFFER</Text>
            <Text style={{ fontSize: 38, fontFamily: 'Helvetica-Bold', color: c.white }}>{cur(offerAmt)}</Text>
            <Text style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 4, textAlign: 'center' }}>All-cash · As-is · No repairs · No agent fees · Close in as few as 7 days</Text>
          </View>

          {/* What You Keep by Going Off-Market */}
          <View wrap={false} style={{ marginBottom: 0 }}>
            <Text style={{ ...s.sectionTitle, marginBottom: 8 }}>What You Keep by Going Off-Market</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {savingsRows.map((row, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: c.lightGray, borderRadius: 5, padding: 10, borderTopWidth: 3, borderTopColor: i === 0 ? c.cyan : i === 1 ? c.yellow : c.green }}>
                  <Text style={{ fontSize: 7, color: c.gray, fontFamily: 'Helvetica-Bold', letterSpacing: 0.7, marginBottom: 4 }}>{row.label.toUpperCase()}</Text>
                  <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: c.navy }}>{cur(row.value)}</Text>
                  <Text style={{ fontSize: 7.5, color: c.gray, marginTop: 3, lineHeight: 1.45 }}>{row.sub}</Text>
                </View>
              ))}
            </View>
            <View style={{ backgroundColor: c.navy, borderRadius: 5, padding: 10, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#94a3b8' }}>Total Savings vs. Listing on the MLS</Text>
              <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: c.green }}>{cur(savings)}</Text>
            </View>
          </View>

        </View>
      </Page>

      {/* ─────────────────────────── PAGE 2 — REPAIR REALITY ─────────────────── */}
      {rehabScan && badCats.length > 0 && (
        <Page size="LETTER" style={s.page}>
          <Header />
          <Footer />

          <View style={s.body}>

            {/* Header bar */}
            <View style={{ backgroundColor: c.navy, borderRadius: 6, padding: 14, marginBottom: 20, borderTopWidth: 3, borderTopColor: c.yellow }}>
              <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: c.white }}>Property Condition & Repair Reality</Text>
              <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>
                {input.address}, {input.city} · Estimated repairs to reach market-ready condition: {cur(repairs)}
              </Text>
            </View>

            {/* Brief explanation */}
            <View style={{ backgroundColor: '#fffbeb', borderRadius: 6, padding: 14, marginBottom: 18, borderLeftWidth: 4, borderLeftColor: c.yellow }}>
              <Text style={{ fontSize: 11, color: c.text, lineHeight: 1.7 }}>
                {'A buyer financing through a bank would require the home to be brought up to retail condition before closing. That means '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{cur(repairs)}</Text>
                {' in repairs — costs that would either come out of your pocket before listing, or be subtracted from your proceeds as buyer credits. We carry that cost so you don\'t have to.'}
              </Text>
            </View>

            {/* Condition table */}
            <View wrap={false}>
              <View style={s.tHead}>
                <View style={{ flex: 3 }}><Text style={s.tHeadCell}>Area</Text></View>
                <View style={{ width: 65 }}><Text style={s.tHeadCell}>Condition</Text></View>
                <View style={{ width: 90 }}><Text style={{ ...s.tHeadCell, textAlign: 'right' }}>Est. Cost Range</Text></View>
              </View>
            </View>
            {badCats.map((cat, i) => (
              <View key={i} style={[s.tRow, i % 2 === 1 ? s.tAlt : {}]} wrap={false}>
                <View style={{ flex: 3 }}>
                  <Text style={{ ...s.tCell, fontFamily: 'Helvetica-Bold' }}>{cat.name}</Text>
                  {cat.notes ? <Text style={{ fontSize: 7.5, color: c.gray, marginTop: 2, lineHeight: 1.5 }}>{cat.notes}</Text> : null}
                </View>
                <View style={{ width: 65, alignSelf: 'flex-start', paddingTop: 1 }}>
                  <Text style={{
                    borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2,
                    fontSize: 7, fontFamily: 'Helvetica-Bold',
                    backgroundColor: cat.condition === 'poor' ? '#fee2e2' : cat.condition === 'good' ? '#d1fae5' : '#fef3c7',
                    color: cat.condition === 'poor' ? c.red : cat.condition === 'good' ? '#065f46' : '#92400e',
                  }}>{cat.condition}</Text>
                </View>
                <View style={{ width: 90, alignSelf: 'flex-start', paddingTop: 1 }}>
                  <Text style={{ ...s.tCell, textAlign: 'right' }}>{cur(cat.estimateLow)} – {cur(cat.estimateHigh)}</Text>
                </View>
              </View>
            ))}
            <View style={s.tTotal} wrap={false}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.navy }}>Total Estimated Repairs</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: c.navy }}>{cur(rehabScan.totalEstimate)}</Text>
            </View>

            {/* AI-added repair items */}
            {addedRepairItems && addedRepairItems.length > 0 && (
              <View style={{ marginTop: 12 }} wrap={false}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.navy, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: c.border }}>Additional Items Identified</Text>
                {addedRepairItems.map((item, i) => (
                  <View key={i} style={[s.tRow, i % 2 === 1 ? s.tAlt : {}]}>
                    <View style={{ flex: 3 }}><Text style={s.tCell}>{item.description}</Text></View>
                    <View style={{ width: 65 }}><Text style={{ ...s.tCell, color: c.gray }}>—</Text></View>
                    <View style={{ width: 90 }}><Text style={{ ...s.tCell, textAlign: 'right' }}>{cur(item.cost)}</Text></View>
                  </View>
                ))}
                <View style={{ ...s.tTotal, backgroundColor: '#fef9c3' }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.navy }}>Additional Items Total</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.navy }}>{cur(addedRepairItems.reduce((s, i) => s + i.cost, 0))}</Text>
                </View>
              </View>
            )}

            {rehabScan.redFlags?.length > 0 && (
              <View style={{ marginTop: 14, backgroundColor: '#fff1f1', borderRadius: 6, padding: 16, borderWidth: 2, borderColor: c.red }} wrap={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ backgroundColor: c.red, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginRight: 10 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.white }}>⚠ URGENT</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: c.red }}>Items Requiring Immediate Attention</Text>
                </View>
                {rehabScan.redFlags.map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 10, paddingBottom: 10, borderBottomWidth: i < rehabScan.redFlags.length - 1 ? 1 : 0, borderBottomColor: '#fecaca' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.red, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 1, flexShrink: 0 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.white }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 10, color: '#1f2937', lineHeight: 1.6 }}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

          </View>
        </Page>
      )}

      {/* ─────────────────────────── LAST PAGE — WHY US + CTA ───────────────── */}
      <Page size="LETTER" style={s.page}>
        <Header />
        <Footer />

        <View style={s.body}>

          {/* Why Sellers Choose Us — 2-col grid */}
          <View style={{ marginBottom: 24 }}>
            <Text style={s.sectionTitle}>Why Sellers Choose {company.name || 'Us'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { title: 'Zero Commissions',  body: 'No agent fees. None. Every dollar of your offer stays yours.' },
                { title: 'Sell As-Is',        body: 'We buy it exactly as it sits. No repairs, no cleaning, no prep.' },
                { title: 'Guaranteed Close',  body: 'Cash buyers don\'t fall through. No financing, no appraisals.' },
                { title: 'Your Timeline',     body: 'Close in 7 days or 90 — whatever works for your life.' },
                { title: 'No Showings',       body: 'Skip the open houses and strangers walking through.' },
                { title: 'No Surprises',      body: 'What we agree on is what you get. No last-minute deductions.' },
              ].map((item, i) => (
                <View key={i} style={{ width: '48%', backgroundColor: c.lightGray, borderRadius: 5, padding: 12, borderLeftWidth: 3, borderLeftColor: c.cyan }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.navy, marginBottom: 3 }}>{item.title}</Text>
                  <Text style={{ fontSize: 9.5, color: c.gray, lineHeight: 1.55 }}>{item.body}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Closing CTA */}
          <View style={s.ctaBox} wrap={false}>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: c.white, marginBottom: 6, textAlign: 'center' }}>
              Ready to Move Forward?
            </Text>
            <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', lineHeight: 1.6, marginBottom: 16 }}>
              No repairs. No showings. No uncertainty. We close on your timeline.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
              {[
                { label: 'Offer Expires',      value: '72 Hours' },
                { label: 'Fastest Close',      value: '7 Days'   },
                { label: 'Fees / Commissions', value: '$0'       },
              ].map(item => (
                <View key={item.label} style={s.ctaStat}>
                  <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.cyan }}>{item.value}</Text>
                  <Text style={{ fontSize: 8, color: '#94a3b8', marginTop: 3 }}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,200,255,0.2)', paddingTop: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5 }}>Call or text us now to accept this offer:</Text>
              {company.phone ? <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: c.cyan }}>{company.phone}</Text> : null}
              {company.email ? <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 5 }}>{company.email}</Text> : null}
            </View>
          </View>

        </View>
      </Page>

    </Document>
  )
}
