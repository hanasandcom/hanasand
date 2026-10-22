import { clientHeaders } from '@/utils/auth/clientHeaders'
import { NextRequest, NextResponse } from 'next/server'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { setAuthCookies } from '../../_authCookies'
import { safeRedirectPath } from '@/utils/auth/safeRedirectPath'
import { loginRedirect, publicUrl, safeSsoReturnTo } from '../redirects'

function failure(req: NextRequest, message: string) {
    const client = req.cookies.get('__Host-sso-mobile-client')?.value
    const response = client === 'desktop' || client === 'mobile'
        ? mobileCallback(client, { error: 'sso_failed' })
        : loginRedirect(req, message)
    clearAuthenticationCookies(response)
    return response
}

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    if (req.nextUrl.searchParams.has('error')) {
        return failure(req, 'SSO sign-in was canceled or rejected.')
    }
    if (!code || !state) {
        return failure(req, 'Missing SSO callback fields.')
    }

    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/sso/callback`, {
        method: 'POST',
        headers: { ...clientHeaders(req), 'Content-Type': 'application/json' },
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

    const mobileClient = req.cookies.get('__Host-sso-mobile-client')?.value
    const codeChallenge = req.cookies.get('__Host-sso-mobile-challenge')?.value
    if (mobileClient !== undefined || codeChallenge !== undefined) {
        if ((mobileClient !== 'desktop' && mobileClient !== 'mobile')
            || typeof codeChallenge !== 'string'
            || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
            await revokeSession(data.token)
            return failure(req, 'SSO sign-in could not be completed.')
        }

        const handoff = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/sso/mobile/code`, {
            method: 'POST',
            headers: {
                ...clientHeaders(req),
                Authorization: `Bearer ${data.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ codeChallenge }),
            cache: 'no-store',
            redirect: 'error',
        }).catch(() => null)
        const handoffData = await handoff?.json().catch(() => null)
        if (!handoff?.ok || typeof handoffData?.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(handoffData.code)) {
            await revokeSession(data.token)
            return failure(req, 'SSO sign-in could not be completed.')
        }

        const response = mobileCallback(mobileClient, { code: handoffData.code })
        clearAuthenticationCookies(response)
        return response
    }

    const returnTo = safeSsoReturnTo(req.cookies.get('__Host-sso-return-to')?.value)
    const response = NextResponse.redirect(returnTo || publicUrl(req, safeRedirectPath(data.redirectPath)))
    setAuthCookies(req, response, data)
    clearAuthenticationCookies(response)
    return response
}

function mobileCallback(client: 'desktop' | 'mobile', result: { code?: string, error?: string }) {
    const target = new URL(client === 'desktop' ? 'hanasand-desktop://sso' : 'hanasand://social')
    if (result.code) target.searchParams.set('code', result.code)
    if (result.error) target.searchParams.set('error', result.error)
    const response = NextResponse.redirect(target, 303)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
}

async function revokeSession(token: string) {
    await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/sessions/revoke`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keep_current: false }),
        cache: 'no-store',
    }).catch(() => null)
}

function clearAuthenticationCookies(response: NextResponse) {
    response.cookies.set('hanasand_auth_binding', '', { httpOnly: true, secure: true, sameSite: 'none', domain: '.hanasand.com', path: '/', maxAge: 0 })
    response.cookies.set('__Host-sso-return-to', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    response.cookies.set('__Host-sso-mobile-challenge', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    response.cookies.set('__Host-sso-mobile-client', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
}
