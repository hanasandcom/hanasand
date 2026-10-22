import { NextRequest, NextResponse } from 'next/server'
import { clientHeaders } from '@/utils/auth/clientHeaders'
import { identityApiUrl } from '@/utils/auth/authApiUrl'

export async function POST(req: NextRequest) {
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/passkeys/authenticate/verify`, {
        method: 'POST',
        headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json' },
        body: await req.text(),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    const data = await upstream.json().catch(() => null)
    if (!upstream.ok || !data?.token || !data?.id) {
        return NextResponse.json(data || { error: 'Passkey login failed.' }, { status: upstream.status })
    }
    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
}
