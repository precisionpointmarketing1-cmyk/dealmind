import { Document, Page, View, Text, Image, Link, StyleSheet } from '@react-pdf/renderer'
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
  approvalUrl?: string
}

function cur(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function SellerReport({ result, company, selectedComps: _selectedComps, selectedARV, ourOffer, sessionPhotos, addedRepairItems, approvalUrl }: Props) {
  const primary = company.primaryColor || '#00c8ff'
  const accent  = company.accentColor  || '#0066cc'
  void accent

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
      backgroundColor: c.white, fontFamily: 'Helvetica', fontSize: 11, color: c.text,
      paddingTop: 32,
      paddingBottom: 64,
      paddingHorizontal: 32,
    },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: 18, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: c.cyan,
    },
    logo:    { width: 130, height: 52, objectFit: 'contain' },
    coName:  { fontSize: 20, fontFamily: 'Helvetica-Bold', color: c.navy },
    coTag:   { fontSize: 9, color: c.gray, marginTop: 2 },
    coInfo:  { fontSize: 9, color: c.gray, marginTop: 2 },
    body: {},
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 13, fontFamily: 'Helvetica-Bold', color: c.navy,
      marginBottom: 10, paddingBottom: 5,
      borderBottomWidth: 1.5, borderBottomColor: c.cyan,
    },
    tHead:      { flexDirection: 'row', backgroundColor: c.navy, borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingHorizontal: 10, paddingVertical: 8 },
    tHeadCell:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.white },
    tRow:       { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    tAlt:       { backgroundColor: '#fafafa' },
    tCell:      { fontSize: 9.5, color: c.text },
    tTotal:     {
      flexDirection: 'row', justifyContent: 'space-between',
      backgroundColor: '#fef3c7', borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
      paddingHorizontal: 10, paddingVertical: 10, borderTopWidth: 1.5, borderTopColor: c.yellow,
    },
    ctaBox: { backgroundColor: c.navy, borderRadius: 10, padding: 22, borderWidth: 2, borderColor: c.cyan },
    footer: { position: 'absolute', bottom: 16, left: 32, right: 32, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
    footerTx:  { fontSize: 8, color: c.gray },
    disclaimer: { fontSize: 7.5, color: c.gray, marginTop: 4, lineHeight: 1.4, textAlign: 'center' },
  })

  const { input, coreMetrics, rehabScan, aiAnalysis } = result
  void aiAnalysis
  const repairs  = input.estimatedRepairs
  const effectiveARV = selectedARV && selectedARV > 0 ? selectedARV : result.arv.adjustedARV
  const offerAmt = (ourOffer && ourOffer > 0) ? ourOffer : coreMetrics.mao
  const badCats  = (rehabScan?.categories ?? []).filter(cat => cat.condition !== 'good')

  const listPrice  = Math.round(effectiveARV * 0.97)
  const agentComm  = Math.round(listPrice * 0.06)
  const closingCst = Math.round(listPrice * 0.02)
  const savings    = agentComm + closingCst + repairs

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const Header = () => (
    <View style={s.header}>
      <View>
        {company.logoBase64
          ? <Image src={company.logoBase64} style={s.logo} />
          : <Text style={s.coName}>{company.name}</Text>}
        {company.tagline ? <Text style={s.coTag}>{company.tagline}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {company.agentName ? <Text style={{ ...s.coInfo, fontFamily: 'Helvetica-Bold', fontSize: 11 }}>{company.agentName}</Text> : null}
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

  const savingsRows = [
    { label: 'Agent Commissions Saved',  value: agentComm,  sub: '6% saved — no listing or buyer agent' },
    { label: 'Repair Costs You Skip',    value: repairs,    sub: 'Sell as-is — we absorb every repair' },
    { label: 'Closing Costs Avoided',    value: closingCst, sub: 'No seller concessions or deductions' },
  ]

  return (
    <Document>

      {/* ── PAGE 1 — OFFER SUMMARY ── */}
      <Page size="LETTER" style={s.page}>
        <Header />
        <Footer />

        <View style={s.body}>

          {/* House photo */}
          {sessionPhotos && sessionPhotos.length > 0 && (
            <View style={{ marginBottom: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden' }} wrap={false}>
              <Image src={sessionPhotos[0]} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
            </View>
          )}

          {/* Address bar */}
          <View style={{
            backgroundColor: c.navy,
            borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
            ...(sessionPhotos?.length ? {} : { borderTopLeftRadius: 6, borderTopRightRadius: 6 }),
            paddingHorizontal: 16, paddingVertical: 12,
            marginBottom: 14,
            borderBottomWidth: 2, borderBottomColor: c.cyan,
          }} wrap={false}>
            <Text style={{ fontSize: 8, color: c.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 3 }}>CASH OFFER SUMMARY</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.white }}>{input.address}</Text>
            <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>
              {input.city}, {input.state} {input.zip}{'   ·   '}{input.bedrooms}bd / {input.bathrooms}ba{'   ·   '}{(input.sqft ?? 0).toLocaleString()} sqft{'   ·   '}{date}
            </Text>
          </View>

          {/* Cash offer amount — full width, prominent */}
          <View wrap={false} style={{ backgroundColor: c.navy, borderRadius: 8, paddingVertical: 22, paddingHorizontal: 20, borderWidth: 2, borderColor: c.cyan, alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 9, color: c.cyan, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, marginBottom: 6 }}>YOUR CASH OFFER</Text>
            <Text style={{ fontSize: 46, fontFamily: 'Helvetica-Bold', color: c.white }}>{cur(offerAmt)}</Text>
            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>All-cash · As-is · No repairs · No agent fees · Close in as few as 7 days</Text>
          </View>

          {/* Savings — single column for mobile readability */}
          <View wrap={false} style={{ marginBottom: 14 }}>
            <Text style={s.sectionTitle}>What You Keep by Going Off-Market</Text>
            {savingsRows.map((row, i) => (
              <View key={i} style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: c.lightGray, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12,
                marginBottom: 6,
                borderLeftWidth: 4, borderLeftColor: i === 0 ? c.cyan : i === 1 ? c.yellow : c.green,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.navy }}>{row.label}</Text>
                  <Text style={{ fontSize: 8.5, color: c.gray, marginTop: 2 }}>{row.sub}</Text>
                </View>
                <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: c.navy, marginLeft: 12 }}>{cur(row.value)}</Text>
              </View>
            ))}
            <View style={{ backgroundColor: c.navy, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>Total Savings vs. Listing on MLS</Text>
              <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: c.green }}>{cur(savings)}</Text>
            </View>
          </View>

          {/* Approval CTA — only if we have a URL */}
          {approvalUrl && (
            <View wrap={false} style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 18, borderWidth: 2, borderColor: c.green, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#065f46', marginBottom: 6, textAlign: 'center' }}>
                Ready to Accept This Offer?
              </Text>
              <Text style={{ fontSize: 10, color: '#047857', textAlign: 'center', marginBottom: 14, lineHeight: 1.5 }}>
                Tap the button below to let us know — our team will reach out within 24 hours to finalize the details.
              </Text>
              <Link src={approvalUrl}>
                <View style={{ backgroundColor: c.green, borderRadius: 6, paddingVertical: 14, paddingHorizontal: 32 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: c.white, textAlign: 'center' }}>
                    ✓  Accept This Offer
                  </Text>
                </View>
              </Link>
              <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 10, textAlign: 'center' }}>
                Or visit: {approvalUrl}
              </Text>
              <Text style={{ fontSize: 7.5, color: '#9ca3af', marginTop: 4, textAlign: 'center' }}>
                Accepting is not legally binding — our team will contact you to finalize.
              </Text>
            </View>
          )}

        </View>
      </Page>

      {/* ── PAGE 2 — REPAIR REALITY (only if AI scan exists) ── */}
      {rehabScan && badCats.length > 0 && (
        <Page size="LETTER" style={s.page}>
          <Header />
          <Footer />

          <View style={s.body}>

            <View style={{ backgroundColor: c.navy, borderRadius: 6, padding: 16, marginBottom: 18, borderTopWidth: 3, borderTopColor: c.yellow }}>
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.white }}>Property Condition & Repair Reality</Text>
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                {input.address}, {input.city} · Estimated repairs to reach market-ready condition: {cur(repairs)}
              </Text>
            </View>

            <View style={{ backgroundColor: '#fffbeb', borderRadius: 6, padding: 14, marginBottom: 18, borderLeftWidth: 4, borderLeftColor: c.yellow }}>
              <Text style={{ fontSize: 11, color: c.text, lineHeight: 1.7 }}>
                {'A buyer financing through a bank would require the home to be brought up to retail condition before closing. That means '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{cur(repairs)}</Text>
                {' in repairs — costs that would either come out of your pocket before listing, or be subtracted from your proceeds as buyer credits. We carry that cost so you don\'t have to.'}
              </Text>
            </View>

            <View wrap={false}>
              <View style={s.tHead}>
                <View style={{ flex: 3 }}><Text style={s.tHeadCell}>Area</Text></View>
                <View style={{ width: 70 }}><Text style={s.tHeadCell}>Condition</Text></View>
                <View style={{ width: 100 }}><Text style={{ ...s.tHeadCell, textAlign: 'right' }}>Est. Cost Range</Text></View>
              </View>
            </View>
            {badCats.map((cat, i) => (
              <View key={i} style={[s.tRow, i % 2 === 1 ? s.tAlt : {}]} wrap={false}>
                <View style={{ flex: 3 }}>
                  <Text style={{ ...s.tCell, fontFamily: 'Helvetica-Bold' }}>{cat.name}</Text>
                  {cat.notes ? <Text style={{ fontSize: 8.5, color: c.gray, marginTop: 2, lineHeight: 1.5 }}>{cat.notes}</Text> : null}
                </View>
                <View style={{ width: 70, alignSelf: 'flex-start', paddingTop: 1 }}>
                  <Text style={{
                    borderRadius: 3, paddingHorizontal: 5, paddingVertical: 3,
                    fontSize: 8, fontFamily: 'Helvetica-Bold',
                    backgroundColor: cat.condition === 'poor' ? '#fee2e2' : cat.condition === 'good' ? '#d1fae5' : '#fef3c7',
                    color: cat.condition === 'poor' ? c.red : cat.condition === 'good' ? '#065f46' : '#92400e',
                  }}>{cat.condition}</Text>
                </View>
                <View style={{ width: 100, alignSelf: 'flex-start', paddingTop: 1 }}>
                  <Text style={{ ...s.tCell, textAlign: 'right' }}>{cur(cat.estimateLow)} – {cur(cat.estimateHigh)}</Text>
                </View>
              </View>
            ))}
            <View style={s.tTotal} wrap={false}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.navy }}>Total Estimated Repairs</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.navy }}>{cur(rehabScan.totalEstimate)}</Text>
            </View>

            {addedRepairItems && addedRepairItems.length > 0 && (
              <View style={{ marginTop: 14 }} wrap={false}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.navy, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: c.border }}>Additional Items Identified</Text>
                {addedRepairItems.map((item, i) => (
                  <View key={i} style={[s.tRow, i % 2 === 1 ? s.tAlt : {}]}>
                    <View style={{ flex: 3 }}><Text style={s.tCell}>{item.description}</Text></View>
                    <View style={{ width: 70 }}><Text style={{ ...s.tCell, color: c.gray }}>—</Text></View>
                    <View style={{ width: 100 }}><Text style={{ ...s.tCell, textAlign: 'right' }}>{cur(item.cost)}</Text></View>
                  </View>
                ))}
                <View style={{ ...s.tTotal, backgroundColor: '#fef9c3' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.navy }}>Additional Items Total</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: c.navy }}>{cur(addedRepairItems.reduce((sum, i) => sum + i.cost, 0))}</Text>
                </View>
              </View>
            )}

            {rehabScan.redFlags?.length > 0 && (
              <View style={{ marginTop: 16, backgroundColor: '#fff1f1', borderRadius: 6, padding: 16, borderWidth: 2, borderColor: c.red }} wrap={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ backgroundColor: c.red, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginRight: 10 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.white }}>⚠ URGENT</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: c.red }}>Items Requiring Immediate Attention</Text>
                </View>
                {rehabScan.redFlags.map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 10, paddingBottom: 10, borderBottomWidth: i < rehabScan.redFlags.length - 1 ? 1 : 0, borderBottomColor: '#fecaca' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.red, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 1, flexShrink: 0 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.white }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 11, color: '#1f2937', lineHeight: 1.6 }}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

          </View>
        </Page>
      )}

      {/* ── LAST PAGE — WHY US + CTA ── */}
      <Page size="LETTER" style={s.page}>
        <Header />
        <Footer />

        <View style={s.body}>

          <View style={{ marginBottom: 24 }}>
            <Text style={s.sectionTitle}>Why Sellers Choose {company.name || 'Us'}</Text>
            {[
              { title: 'Zero Commissions',  body: 'No agent fees. None. Every dollar of your offer stays yours.' },
              { title: 'Sell As-Is',        body: 'We buy it exactly as it sits. No repairs, no cleaning, no prep.' },
              { title: 'Guaranteed Close',  body: "Cash buyers don't fall through. No financing, no appraisals." },
              { title: 'Your Timeline',     body: 'Close in 7 days or 90 — whatever works for your life.' },
              { title: 'No Showings',       body: 'Skip the open houses and strangers walking through.' },
              { title: 'No Surprises',      body: 'What we agree on is what you get. No last-minute deductions.' },
            ].map((item, i) => (
              <View key={i} style={{ backgroundColor: c.lightGray, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6, borderLeftWidth: 4, borderLeftColor: c.cyan, flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.navy, marginBottom: 2 }}>{item.title}</Text>
                  <Text style={{ fontSize: 10, color: c.gray, lineHeight: 1.5 }}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Final CTA */}
          <View style={s.ctaBox} wrap={false}>
            <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.white, marginBottom: 6, textAlign: 'center' }}>
              Ready to Move Forward?
            </Text>
            <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.6, marginBottom: 16 }}>
              No repairs. No showings. No uncertainty. We close on your timeline.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
              {[
                { label: 'Offer Expires',      value: '72 Hours' },
                { label: 'Fastest Close',      value: '7 Days'   },
                { label: 'Fees / Commissions', value: '$0'       },
              ].map(item => (
                <View key={item.label} style={{ alignItems: 'center', backgroundColor: '#1e2d4a', borderRadius: 6, paddingVertical: 12, paddingHorizontal: 18, minWidth: 100 }}>
                  <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: c.cyan }}>{item.value}</Text>
                  <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,200,255,0.2)', paddingTop: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Call or text us now to accept this offer:</Text>
              {company.phone ? <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: c.cyan }}>{company.phone}</Text> : null}
              {company.email ? <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>{company.email}</Text> : null}
            </View>
            {approvalUrl && (
              <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,200,255,0.2)', paddingTop: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>Or respond online:</Text>
                <Link src={approvalUrl}>
                  <View style={{ backgroundColor: c.green, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 28 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: c.white }}>✓  Accept This Offer Online</Text>
                  </View>
                </Link>
              </View>
            )}
          </View>

        </View>
      </Page>

    </Document>
  )
}
