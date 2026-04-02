import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('statement') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  // Support both images and PDFs
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  const contentBlock = isPDF
    ? {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64,
        },
      }

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          contentBlock as any,
          {
            type: 'text',
            text: `You are an expert mortgage analyst. Extract the key loan details from this mortgage statement.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "lenderName": "Bank of America",
  "loanBalance": 185000,
  "monthlyPITI": 1450,
  "interestRate": 0.035,
  "remainingMonths": 312,
  "originalLoanAmount": 210000,
  "nextPaymentDate": "2024-02-01",
  "propertyAddress": "123 Main St",
  "confidence": "high|medium|low",
  "notes": "any caveats or important details"
}

If you cannot find a value with confidence, use null for that field.
interestRate should be a decimal (e.g. 3.5% = 0.035).
remainingMonths should be an integer.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch {
    // Try to extract JSON from the response if it has extra text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return NextResponse.json(JSON.parse(match[0]))
      } catch {}
    }
    return NextResponse.json({ error: 'Could not parse statement', raw: text.slice(0, 300) }, { status: 500 })
  }
}
