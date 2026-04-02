import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120 // allow up to 2 min for multi-photo Claude call

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const files = formData.getAll('photos') as File[]

  if (!files.length) {
    return NextResponse.json({ error: 'No photos provided' }, { status: 400 })
  }

  // Convert files to base64 for Claude vision
  const images = await Promise.all(
    files.slice(0, 30).map(async file => {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      return { base64, mediaType }
    })
  )

  const imageBlocks = images.map(img => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mediaType,
      data: img.base64,
    },
  }))

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `You are a seasoned real estate contractor and property estimator with 25+ years flipping houses across the US. Estimate rehab costs for this property using NATIONWIDE AVERAGE contractor pricing — not high-cost coastal markets.

CRITICAL RULES — follow without exception:
1. ALWAYS return JSON. Never refuse or say photos are insufficient.
2. Use REALISTIC nationwide averages — do NOT inflate. Most investors are in mid-size US cities.
3. Output ONLY the raw JSON object — no markdown fences, no text before or after.
4. If a category is in GOOD condition and needs NO work, set both estimateLow AND estimateHigh to $0. Do NOT invent work for categories that are fine.
5. NEW CONSTRUCTION / EXCELLENT CONDITION RULE: If the property appears to be new construction, newly renovated, or move-in ready, most categories should be $0. rentalRehab and fullFixFlip should both be very low (under $5,000 total) — only include actual observable issues. Do NOT assume problems that aren't visible in brand-new or like-new properties.
6. Only assume AVERAGE/FAIR condition for items that are NOT visible AND the property clearly shows age or wear. For new construction, assume GOOD condition for anything not visibly damaged.

You must produce TWO separate budget scenarios:
- "rentalRehab": Rent-ready scope — minimum work needed to rent immediately. If property is move-in ready, this is $0 or near-zero.
- "fullFixFlip": Retail-ready scope — work to maximize resale value. For new/excellent condition homes this is also near-zero; only include genuine upgrades that would meaningfully increase value.

Return this exact JSON structure:
{
  "rentalRehab": 0,
  "fullFixFlip": 2500,
  "totalEstimate": 2500,
  "confidence": "high|medium|low",
  "summary": "2-3 sentence plain-English overview of overall condition. If new or excellent condition, say so clearly.",
  "categories": [
    {
      "name": "Roof",
      "estimateLow": 0,
      "estimateHigh": 0,
      "condition": "good",
      "notes": "New construction — no work needed"
    }
  ],
  "redFlags": [],
  "assumptions": ["Items assumed based on visible condition"],
  "photoLabels": ["Exterior Front", "Living Room", "Kitchen"],
  "photoOrder": [0, 2, 1]
}

PHOTO WALKTHROUGH RULES:
- photoLabels: array of exactly the same length as the number of photos provided. Label each photo with its room or area (e.g. "Exterior Front", "Exterior Rear", "Driveway / Garage", "Entry / Foyer", "Living Room", "Dining Room", "Kitchen", "Master Bedroom", "Bedroom 2", "Master Bathroom", "Bathroom 2", "Laundry Room", "Basement", "Backyard / Patio", "Roof", "HVAC / Mechanical").
- photoOrder: suggest an order for the photos as if walking through the house (start outside → entry → main living areas → kitchen → bedrooms → bathrooms → utility → outside/yard). This is an array of the original photo indices in suggested walkthrough order.
- If the same room appears in multiple photos, label them "Kitchen (1)", "Kitchen (2)", etc.

For each category: estimateLow = rental rehab cost, estimateHigh = full fix & flip cost. Both $0 is correct and expected for categories in good condition.

CONDITION ASSESSMENT GUIDE:
- New construction / built last 5 years: assume GOOD on everything unless visibly defective → $0
- Recently renovated (new finishes visible): assume GOOD on renovated items → $0
- Older home with visible wear: assume FAIR → use low-end pricing
- Visibly damaged/broken: assume POOR → use mid-range pricing

NATIONWIDE AVERAGE PRICING (2024-2025) — only apply when work is actually needed:
- Roof replacement: $6,000–$12,000. Repair only: $500–$2,500. New roof → $0
- HVAC full replace: $4,500–$8,500. New system → $0
- Kitchen cosmetic: $1,500–$4,000. Full remodel: $10,000–$25,000. New kitchen → $0
- Bathroom cosmetic: $800–$2,500 each. Full remodel: $4,000–$10,000. New baths → $0
- Flooring (full house LVP): $2,500–$7,000. New flooring → $0
- Interior paint: $1,800–$4,500. New paint → $0
- Exterior paint: $1,500–$5,000. New exterior → $0
- Electrical panel upgrade: $1,500–$4,000. New electrical → $0
- Plumbing repiping: $2,000–$6,000. New plumbing → $0
- Windows (full set): $3,500–$8,000. New windows → $0
- Foundation repair: $500–$20,000. New construction → $0
- Landscaping: $500–$3,000
- Demo/haul-off: $500–$2,500 (only if demo work is needed)
- Contingency: 8% of actual subtotal (if subtotal is $0, contingency is $0)

Categories to always include (use $0 for items in good condition):
- Roof
- HVAC (heating + cooling)
- Plumbing
- Electrical
- Foundation / Structural
- Kitchen
- Bathrooms (combine all baths)
- Flooring
- Interior Paint / Drywall
- Exterior Paint / Siding
- Windows / Doors
- Landscaping / Curb Appeal
- Demo / Cleanup / Haul-off
- Contingency (8% of actual subtotal only)`,
          },
        ],
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  // Strip markdown code fences if present
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch {
    // Try to extract JSON object from surrounding text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return NextResponse.json(JSON.parse(match[0]))
      } catch { /* fall through */ }
    }
    console.error('Photo scan parse failed. Raw response:', raw.slice(0, 1000))
    return NextResponse.json({ error: 'Failed to parse AI response', raw: raw.slice(0, 500) }, { status: 500 })
  }
}
