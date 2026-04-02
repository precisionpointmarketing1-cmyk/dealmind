import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { description } = await req.json()
  if (!description?.trim()) {
    return NextResponse.json({ error: 'No description provided' }, { status: 400 })
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are a seasoned US contractor estimating repair costs using nationwide average pricing (not high-cost coastal markets).

Repair item: "${description.trim()}"

Return ONLY a raw JSON object — no markdown, no explanation:
{
  "low": <number>,
  "high": <number>,
  "mid": <number>,
  "notes": "<one sentence explaining what's included>"
}

Rules:
- Use 2024-2025 nationwide average contractor pricing
- low = minimum realistic cost, high = full scope, mid = recommended budget
- All values are whole dollar integers
- If the description is vague (e.g. "roof"), assume a standard single-family home
- Do NOT refuse or return anything other than the JSON object`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { return NextResponse.json(JSON.parse(match[0])) } catch { /* fall through */ }
    }
    return NextResponse.json({ error: 'Failed to parse estimate' }, { status: 500 })
  }
}
