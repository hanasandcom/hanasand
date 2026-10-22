import { NextRequest, NextResponse } from 'next/server'
import { clientHeaders } from '@/utils/auth/clientHeaders'
import { identityApiUrl } from '@/utils/auth/authApiUrl'

export async function POST(req: NextRequest) {
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/sso/mobile/exchange`, {
        method: 'POST',
        headers: { ...clientHeaders(req), 'Content-Type': 'application/json' },
        body: await req.text(),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) return noStore(NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 }))
    const data = await upstream.json().catch(() => null)
    const response = NextResponse.json(data || { error: 'SSO sign-in failed.' }, { status: upstream.status })
    return noStore(response)
}

function noStore(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
}
