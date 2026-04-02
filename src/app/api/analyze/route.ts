import { NextRequest, NextResponse } from 'next/server'
import { analyzeProperty } from '@/lib/calculations'
import { DealInput } from '@/types/deal'
import { DEFAULTS } from '@/lib/utils/constants'

export async function POST(req: NextRequest) {
  try {
    const input: DealInput = await req.json()

    if (!input.address || !input.city || !input.state || !input.zip) {
      return NextResponse.json({ error: 'Property address is required' }, { status: 400 })
    }
    if (!input.estimatedRepairs && input.estimatedRepairs !== 0) {
      return NextResponse.json({ error: 'Repair estimate is required' }, { status: 400 })
    }

    // If no asking price, we'll default to MAO after ARV is calculated.
    // Set a temporary placeholder — the orchestrator will fix it.
    const inputWithDefaults: DealInput = {
      ...input,
      estimatedARV: input.estimatedARV || 0,  // will be overridden by RentCast
      askingPrice: input.askingPrice || 0,     // 0 = "use MAO" signal
    }

    const result = await analyzeProperty(inputWithDefaults)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Analyze error:', err)
    return NextResponse.json({ error: err.message ?? 'Analysis failed' }, { status: 500 })
  }
}
