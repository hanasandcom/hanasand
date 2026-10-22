import { clientHeaders } from '@/utils/auth/clientHeaders'
import { NextRequest, NextResponse } from 'next/server'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { setAuthCookies } from '../../_authCookies'
import { safeRedirectPath } from '@/utils/auth/safeRedirectPath'
import { loginRedirect, publicUrl, safeSsoReturnTo } from '../redirects'

function failure(req: NextRequest, message: string) {
    const response = loginRedirect(req, message)
    response.cookies.set('hanasand_auth_binding', '', { httpOnly: true, secure: true, sameSite: 'none', domain: '.hanasand.com', path: '/', maxAge: 0 })
    response.cookies.set('__Host-sso-return-to', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
}

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    if (!code || !state) {
        return failure(req, 'Missing SSO callback fields.')
    }

    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/sso/callback`, {
        method: 'POST',
        headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state, binding: req.cookies.get('hanasand_auth_binding')?.value }),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        return failure(req, 'Authentication service is unavailable.')
    }

    const data = await upstream.json().catch(() => null)
    if (!upstream.ok || !data?.token || !data?.id) {
        return failure(req, data?.error || 'SSO login failed.')
    }

    const returnTo = safeSsoReturnTo(req.cookies.get('__Host-sso-return-to')?.value)
    const response = NextResponse.redirect(returnTo || publicUrl(req, safeRedirectPath(data.redirectPath)))
    setAuthCookies(req, response, data)
    response.cookies.set('hanasand_auth_binding', '', { httpOnly: true, secure: true, sameSite: 'none', domain: '.hanasand.com', path: '/', maxAge: 0 })
    response.cookies.set('__Host-sso-return-to', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
}
