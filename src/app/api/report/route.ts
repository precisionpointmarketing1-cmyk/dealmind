import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'
import { InvestorReport } from '@/components/reports/InvestorReport'
import { CompanySettings, DEFAULT_COMPANY } from '@/types/company'
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

  // Subject property — large gold star pin
  if (result.input.lat && result.input.lng) {
    markers.push(`pin-l-star+ffd700(${result.input.lng},${result.input.lat})`)
  }

  // Comp pins (small blue) — up to 15 with coordinates
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
  const body = await req.json()
  // Support both { result, photos, selectedComps } and legacy plain result
  let result: AnalysisResult = body.result ?? body
  const photos: string[]       = body.photos ?? result.propertyPhotos ?? []
  const selectedComps: SaleComp[] | undefined = body.selectedComps?.length > 0 ? body.selectedComps : undefined
  const addedRepairItems: { description: string; cost: number }[] | undefined = body.addedRepairItems?.length > 0 ? body.addedRepairItems : undefined
  if (body.activeRepairs > 0) result = patchRepairs(result, body.activeRepairs)

  const company = loadCompany()
  const mapImageUrl = buildMapUrl(result)

  const element = React.createElement(InvestorReport, { result, company, photos, mapImageUrl, selectedComps, addedRepairItems }) as any
  const buffer = await renderToBuffer(element)
  const uint8 = new Uint8Array(buffer)

  const address = `${result.input.address}-${result.input.city}-${result.input.state}`
    .replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60)

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="DealReport-${address}.pdf"`,
    },
  })
}
