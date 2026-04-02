import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'
import { AcquisitionsReport } from '@/components/reports/AcquisitionsReport'
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    let result: AnalysisResult = body.result ?? body
    const selectedComps: SaleComp[] | undefined = body.selectedComps?.length > 0 ? body.selectedComps : undefined
    const selectedARV: number | undefined = body.selectedARV ?? undefined
    const addedRepairItems: { description: string; cost: number }[] | undefined = body.addedRepairItems?.length > 0 ? body.addedRepairItems : undefined
    if (body.activeRepairs > 0) result = patchRepairs(result, body.activeRepairs)
    const company = loadCompany()

    const element = React.createElement(AcquisitionsReport, { result, company, selectedComps, selectedARV, addedRepairItems }) as any
    const buffer = await renderToBuffer(element)
    const uint8 = new Uint8Array(buffer)

    const address = `${result.input.address}-${result.input.city}-${result.input.state}`
      .replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60)

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AcquisitionsReport-${address}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('Acquisitions report error:', err)
    return NextResponse.json({ error: err.message ?? 'Acquisitions report generation failed' }, { status: 500 })
  }
}
