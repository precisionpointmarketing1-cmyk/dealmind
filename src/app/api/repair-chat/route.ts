import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { messages, existingItems } = await req.json()
  // messages: { role: 'user'|'assistant', content: string }[]
  // existingItems: { description: string, cost: number }[]

  const system = `You are a seasoned US real estate contractor and rehab estimator with 25+ years experience flipping houses.
You help investors build accurate repair budgets by having a conversation about the property's condition.

The investor will describe what they see, known issues, seller disclosures, or ask questions. You:
1. IMMEDIATELY extract and price every repair item mentioned — do NOT ask clarifying questions unless the item is completely unclear
2. If the investor gives a dollar amount (e.g. "add 15k for foundation"), use their number directly — set low/mid/high close to that amount without asking follow-up questions
3. Price each item using NATIONWIDE AVERAGE contractor pricing (not high-cost coastal markets)
4. Keep replies brief — confirm what you added and move on. One sentence max unless they ask for explanation.
5. Never ask about property type, size, age, or scope details unless the user has given you nothing to work with

${existingItems?.length > 0 ? `Already in their budget: ${existingItems.map((i: any) => `${i.description} ($${i.cost.toLocaleString()})`).join(', ')}` : ''}

CRITICAL: Always end your response with a JSON block in this exact format (even if no new items):
<items>
[
  {
    "description": "Clear repair item description",
    "low": 1500,
    "mid": 3500,
    "high": 6000,
    "notes": "One sentence: what's included and any assumptions"
  }
]
</items>

If nothing new to add, return <items>[]</items>

Pricing guidelines (2024-2025 nationwide averages):
- Roof replacement: $6k–$12k | Repair only: $500–$2.5k
- HVAC full replace: $4.5k–$8.5k
- Water heater: $800–$1.8k
- Kitchen remodel (full): $10k–$25k | Cosmetic: $1.5k–$4k
- Bathroom remodel (full): $4k–$10k | Cosmetic: $800–$2.5k
- Flooring (full house LVP): $2.5k–$7k
- Foundation repair: $500–$20k depending on severity
- Electrical panel: $1.5k–$4k | Full rewire: $8k–$20k
- Plumbing repiping: $2k–$6k
- Windows (full set): $3.5k–$8k
- Interior paint: $1.8k–$4.5k
- Exterior paint/siding: $1.5k–$5k

Be conversational, helpful, and specific. Don't pad estimates — use realistic mid-market pricing.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system,
    messages,
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  // Extract items JSON from <items>...</items> block
  const itemsMatch = raw.match(/<items>([\s\S]*?)<\/items>/)
  let items: any[] = []
  if (itemsMatch) {
    try { items = JSON.parse(itemsMatch[1].trim()) } catch { items = [] }
  }

  // Strip the <items> block from the visible reply
  const reply = raw.replace(/<items>[\s\S]*?<\/items>/g, '').trim()

  return NextResponse.json({ reply, items })
}
