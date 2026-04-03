import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'
import { SellerReport } from '@/components/reports/SellerReport'
import { InvestorReport } from '@/components/reports/InvestorReport'
import { CompanySettings, DEFAULT_COMPANY } from '@/types/company'
import { getSession } from '@/lib/auth'
import { findUserById } from '@/lib/users'
import { AnalysisResult, SaleComp } from '@/types/deal'
import { patchRepairs } from '@/lib/utils/patch-repairs'

function loadCompany(): CompanySettings {
  try {
    return { ...DEFAULT_COMPANY, ...JSON.parse(readFileSync(join(process.cwd(), 'data', 'company.json'), 'utf-8')) }
  } catch {
    return DEFAULT_COMPANY
  }
}

function buildMapUrl(result: AnalysisResult): string {
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) return ''
  const markers: string[] = []
  if (result.input.lat && result.input.lng) {
    markers.push(`pin-l-star+ffd700(${result.input.lng},${result.input.lat})`)
  }
  const compsWithCoords = (result.saleComps?.comparables ?? [])
    .filter((c: SaleComp) => c.lat && c.lng)
    .slice(0, 15)
  compsWithCoords.forEach((c: SaleComp) => {
    markers.push(`pin-s+3498db(${c.lng},${c.lat})`)
  })
  if (markers.length === 0) return ''
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${markers.join(',')}/auto/640x320@2x?access_token=${token}&padding=60,60,60,60`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reportType, toEmail, toName, subject, message } = body as {
      reportType: 'seller' | 'investor'
      toEmail: string
      toName?: string
      subject?: string
      message?: string
    }

    if (!toEmail) return NextResponse.json({ error: 'toEmail is required' }, { status: 400 })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey || resendKey === 're_your_key_here') {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured in .env.local' }, { status: 500 })
    }

    let result: AnalysisResult = body.result ?? body
    const selectedComps: SaleComp[] | undefined = body.selectedComps?.length > 0 ? body.selectedComps : undefined
    const selectedARV: number | undefined = body.selectedARV ?? undefined
    const addedRepairItems: { description: string; cost: number }[] | undefined = body.addedRepairItems?.length > 0 ? body.addedRepairItems : undefined
    if (body.activeRepairs > 0) result = patchRepairs(result, body.activeRepairs)

    const company = loadCompany()
    const address = `${result.input.address}, ${result.input.city}, ${result.input.state}`
    const fileSlug = `${result.input.address}-${result.input.city}-${result.input.state}`
      .replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60)

    let pdfBuffer: Buffer
    let filename: string
    let defaultSubject: string

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:8080'
    let approvalUrl: string | undefined

    if (reportType === 'seller') {
      const ourOffer: number | undefined = body.ourOffer ?? undefined
      const sessionPhotos: string[] | undefined = body.sessionPhotos?.length > 0 ? body.sessionPhotos : undefined

      // Generate approval token and register it
      const token = randomUUID()
      approvalUrl = `${appUrl}/seller-response/${token}`
      const offerAmt = Number(body.offerAmt) || (ourOffer && ourOffer > 0 ? ourOffer : Number(result.coreMetrics?.mao)) || 0
      const session = await getSession()
      const sentByUser = session ? findUserById(session.userId) : null
      fetch(`${appUrl}/api/seller-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, address, offerAmt, sellerName: toName,
          dealSnapshot: { input: result.input, offerAmt },
          sentByUserId: sentByUser?.id,
          sentByEmail: sentByUser?.email,
          sentByName: sentByUser?.name,
        }),
      }).catch(() => {})

      const element = React.createElement(SellerReport, { result, company, selectedComps, selectedARV, ourOffer, sessionPhotos, addedRepairItems, approvalUrl }) as any
      pdfBuffer = Buffer.from(await renderToBuffer(element))
      filename = `CashOffer-${fileSlug}.pdf`
      defaultSubject = `Cash Offer — ${address}`
    } else {
      const photos: string[] = body.photos ?? result.propertyPhotos ?? []
      const mapImageUrl = buildMapUrl(result)
      const element = React.createElement(InvestorReport, { result, company, photos, mapImageUrl, selectedComps, selectedARV, addedRepairItems }) as any
      pdfBuffer = Buffer.from(await renderToBuffer(element))
      filename = `InvestorDealReport-${fileSlug}.pdf`
      defaultSubject = `Investor Deal Report — ${address}`
    }

    const resend = new Resend(resendKey)
    const fromAddress = process.env.EMAIL_FROM ?? 'deals@resend.dev'

    // Use company branding colors with sensible fallbacks
    const brandBg     = company.primaryColor || '#00c8ff'
    const brandNavy   = '#0f1628'
    const brandAccent = company.accentColor  || brandBg

    const greeting = toName ? `Hi ${toName.split(' ')[0]},` : 'Hello,'
    const customMsg = message?.trim() ? `<p style="color:#374151;font-size:17px;line-height:1.7;margin:0 0 16px">${message.replace(/\n/g, '<br/>')}</p>` : ''
    const isSeller = reportType === 'seller'

    const approvalButtons = approvalUrl ? `
    <div style="margin:32px 0;background:#f0fdf4;border-radius:12px;padding:28px 24px;text-align:center;border:2px solid #86efac">
      <p style="margin:0 0 6px;font-size:20px;font-weight:bold;color:#111827">Ready to move forward?</p>
      <p style="margin:0 0 22px;font-size:15px;color:#6b7280">Let us know and we'll be in touch within 24 hours.</p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px">
        <tr>
          <td style="padding-right:12px">
            <a href="${approvalUrl}?action=accepted" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:18px;font-weight:bold;padding:18px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.3px">✓&nbsp;&nbsp;Yes, Accept This Offer</a>
          </td>
          <td>
            <a href="${approvalUrl}?action=declined" style="display:inline-block;background:#ffffff;color:#6b7280;font-size:15px;font-weight:600;padding:18px 28px;border-radius:10px;text-decoration:none;border:2px solid #d1d5db">✕&nbsp;&nbsp;No Thanks</a>
          </td>
        </tr>
      </table>
      <div style="background:#fef9c3;border-radius:8px;padding:14px 18px;margin-top:4px">
        <p style="margin:0;font-size:14px;font-weight:bold;color:#854d0e">⚠ This is NOT a legally binding agreement</p>
        <p style="margin:6px 0 0;font-size:13px;color:#92400e;line-height:1.5">Clicking "Accept" simply lets us know you are interested. Our team will contact you to review all terms and sign formal paperwork before anything is official.</p>
      </div>
    </div>` : ''

    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <tr><td style="background:${brandNavy};padding:24px 32px;text-align:center;border-bottom:3px solid ${brandBg}">
    ${company.logoBase64 ? `<img src="${company.logoBase64}" alt="${company.name}" style="max-height:48px;max-width:200px;object-fit:contain;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto" />` : ''}
    <p style="margin:0;color:${brandBg};font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">${company.name}</p>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:12px">${company.phone ?? ''}${company.phone && company.email ? '  ·  ' : ''}${company.email ?? ''}</p>
  </td></tr>
  <tr><td style="padding:36px">
    <p style="margin:0 0 18px;color:#111827;font-size:18px;font-weight:bold">${greeting}</p>
    ${customMsg || `<p style="color:#374151;font-size:17px;line-height:1.7;margin:0 0 16px">We've prepared a <strong>${isSeller ? 'cash offer' : 'investor deal report'}</strong> for <strong>${address}</strong>. The full details are attached as a PDF.</p>`}
    <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 24px">Feel free to review the attached report and reach out with any questions — we're happy to walk you through it.</p>
    <div style="margin:0 0 28px;padding:20px 24px;background:#f3f4f6;border-radius:8px;border-left:4px solid ${brandAccent}">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:bold;text-transform:uppercase;letter-spacing:1px">Property</p>
      <p style="margin:0;font-size:18px;font-weight:bold;color:#111827">${address}</p>
    </div>
    ${approvalButtons}
    <p style="color:#111827;font-size:16px;margin-top:24px;line-height:1.7">Best regards,<br><strong>${company.agentName ?? company.name}</strong><br>
    <span style="color:#6b7280;font-size:14px">${company.phone ?? ''}</span></p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:11px;color:#9ca3af">This email was sent by ${company.name}. The attached report is for informational purposes only and is subject to inspection and final due diligence.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

    const emailText = `${greeting}\n\nPlease find your ${isSeller ? 'cash offer summary' : 'investor deal report'} for ${address} attached.\n\nBest regards,\n${company.agentName ?? company.name}\n${company.phone ?? ''}`

    const { data, error } = await resend.emails.send({
      from: `${company.name} <${fromAddress}>`,
      to: toName ? `${toName} <${toEmail}>` : toEmail,
      replyTo: company.email ?? fromAddress,
      subject: subject?.trim() || defaultSubject,
      html: emailHtml,
      text: emailText,
      attachments: [{ filename, content: pdfBuffer }],
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: data?.id })
  } catch (err: any) {
    console.error('Email report error:', err)
    return NextResponse.json({ error: err.message ?? 'Failed to send email' }, { status: 500 })
  }
}
