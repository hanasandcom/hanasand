import { NextResponse } from 'next/server'

export async function proxyPasskeyJsonResponse(upstream: Response | null) {
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status })
}
