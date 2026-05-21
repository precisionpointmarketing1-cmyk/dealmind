import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth', '/seller-response', '/api/seller-response']
const ASSET_PREFIXES = ['/_next', '/favicon', '/logo', '/public']

// Edge-compatible HMAC-SHA256 verification (Node's crypto.createHmac is Node-only,
// so we can't import @/lib/auth's verifySession into middleware).
async function verifyHmacSha256(payload: string, hexSig: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    if (hexSig.length % 2 !== 0) return false
    const sigBytes = new Uint8Array(hexSig.length / 2)
    for (let i = 0; i < hexSig.length; i += 2) {
      const byte = parseInt(hexSig.slice(i, i + 2), 16)
      if (Number.isNaN(byte)) return false
      sigBytes[i / 2] = byte
    }
    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload))
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (ASSET_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  const value = req.cookies.get('dm_session')?.value
  if (!value) return NextResponse.redirect(new URL('/login', req.url))

  // Fail-closed if AUTH_SECRET isn't configured — better to lock everyone out
  // than to let any cookie value pass.
  const secret = process.env.AUTH_SECRET
  if (!secret) return NextResponse.redirect(new URL('/login', req.url))

  const lastDot = value.lastIndexOf('.')
  if (lastDot === -1) return NextResponse.redirect(new URL('/login', req.url))
  const payload = value.slice(0, lastDot)
  const sig = value.slice(lastDot + 1)
  if (!payload || !sig) return NextResponse.redirect(new URL('/login', req.url))

  const valid = await verifyHmacSha256(payload, sig, secret)
  if (!valid) return NextResponse.redirect(new URL('/login', req.url))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
