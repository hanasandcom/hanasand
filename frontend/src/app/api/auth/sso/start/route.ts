import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { clientHeaders } from '@/utils/auth/clientHeaders'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { safeRedirectPath } from '@/utils/auth/safeRedirectPath'
import { loginRedirect, safeSsoReturnTo } from '../redirects'

export async function GET(req: NextRequest) {
    const redirectPath = safeRedirectPath(req.nextUrl.searchParams.get('redirectPath') || req.nextUrl.searchParams.get('path'))
    const returnToValues = req.nextUrl.searchParams.getAll('returnTo')
    const returnTo = returnToValues.length === 1 ? safeSsoReturnTo(returnToValues[0]) : null
    if (returnToValues.length > 1 || (returnToValues.length === 1 && !returnTo)) {
        return loginRedirect(req, 'SSO return address is not allowed.')
    }
    const binding = randomBytes(32).toString('base64url')
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/sso/start`, {
        method: 'POST', headers: { ...clientHeaders(req), 'Content-Type': 'application/json' },
        body: JSON.stringify({ binding, redirectPath }), cache: 'no-store', redirect: 'error',
    }).catch(() => null)
    if (!upstream) return loginRedirect(req, 'Authentication service is unavailable.')
    const data = await upstream.json().catch(() => null)
    if (!upstream.ok || !data?.url || !safeProviderRedirect(data.url)) return loginRedirect(req, data?.error || 'SSO login is unavailable.')
    const response = NextResponse.redirect(data.url, 303)
    response.cookies.set('hanasand_auth_binding', binding, { httpOnly: true, secure: true, sameSite: 'none', domain: '.hanasand.com', path: '/', maxAge: 600 })
    if (returnTo) {
        response.cookies.set('__Host-sso-return-to', returnTo, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 })
    } else {
        response.cookies.set('__Host-sso-return-to', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    }
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
