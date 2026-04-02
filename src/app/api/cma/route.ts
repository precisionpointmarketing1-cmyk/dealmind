import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.CLOUD_CMA_API_KEY!

export async function POST(req: NextRequest) {
  const { address, city, state, zip, beds, baths, sqft, email } = await req.json()

  if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 })

  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ')

  // Build Cloud CMA widget URL — opens a pre-filled CMA in their UI
  const params = new URLSearchParams({
    api_key: API_KEY,
    address: fullAddress,
    ...(beds   ? { beds:   String(beds)   } : {}),
    ...(baths  ? { baths:  String(baths)  } : {}),
    ...(sqft   ? { sqft:   String(sqft)   } : {}),
    ...(email  ? { email_to: email        } : {}),
  })

  // Also try to POST to create the CMA programmatically
  try {
    const res = await fetch(`https://cloudcma.com/cmas/widget?${params}`, {
      method: 'GET',
      redirect: 'follow',
    })

    // Cloud CMA redirects to the report — return the final URL
    return NextResponse.json({
      url: res.url || `https://cloudcma.com/cmas/new?${params}`,
      directUrl: `https://cloudcma.com/cmas/new?${params}`,
    })
  } catch {
    return NextResponse.json({
      url: `https://cloudcma.com/cmas/new?${params}`,
      directUrl: `https://cloudcma.com/cmas/new?${params}`,
    })
  }
}
