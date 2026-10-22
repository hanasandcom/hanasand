import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { clientHeaders } from '@/utils/auth/clientHeaders'
import { identityApiUrl } from '@/utils/auth/authApiUrl'

export async function GET(req: NextRequest) {
    const codeChallenge = req.nextUrl.searchParams.get('code_challenge')
    if (!codeChallenge || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
        return NextResponse.json({ error: 'Mobile sign-in could not be started.' }, { status: 400 })
    }

    const binding = randomBytes(32).toString('base64url')
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/sso/mobile/start`, {
        method: 'POST',
        headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({ binding, codeChallenge }),
        cache: 'no-store',
        redirect: 'error',
    }).catch(() => null)
    if (!upstream) return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })

    const data = await upstream.json().catch(() => null)
    if (!upstream.ok || typeof data?.url !== 'string' || !safeProviderRedirect(data.url)) {
        return NextResponse.json({ error: data?.error || 'SSO login is unavailable.' }, { status: upstream.status || 502 })
    }

    const response = NextResponse.redirect(data.url, 303)
    response.cookies.set('hanasand_auth_binding', binding, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        domain: '.hanasand.com',
        path: '/',
        maxAge: 600,
    })
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
}

function safeProviderRedirect(location: string) {
    try {
        const url = new URL(location)
        if (url.protocol === 'https:') return true
        return process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    } catch {
        return false
    }
}
