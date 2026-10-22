import { NextRequest, NextResponse } from 'next/server'
import { clientHeaders } from '@/utils/auth/clientHeaders'
import { identityApiUrl } from '@/utils/auth/authApiUrl'

const LOGIN_TIMEOUT_MS = 15_000

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!id || !password) {
        return noStore(NextResponse.json({ error: 'Username and password are required.' }, { status: 400 }))
    }

    const timeoutSignal = AbortSignal.timeout(LOGIN_TIMEOUT_MS)
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/login/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { ...clientHeaders(req), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
        signal: timeoutSignal,
    }).catch(() => null)

    if (!upstream) {
        const status = timeoutSignal.aborted ? 504 : 502
        const message = timeoutSignal.aborted
            ? 'Authentication service timed out. Please try again.'
            : 'Authentication service is unavailable.'
        return noStore(NextResponse.json({ error: message }, { status }))
    }

    const data = await upstream.json().catch(() => null)
    if (!upstream.ok) {
        return noStore(NextResponse.json(data || { error: 'Unable to log in.' }, { status: upstream.status }))
    }
    if (!data?.token || !data?.id || !data?.name) {
        return noStore(NextResponse.json({ error: 'Login succeeded, but the session could not be created.' }, { status: 502 }))
    }
    return noStore(NextResponse.json(data))
}

function noStore(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
}
