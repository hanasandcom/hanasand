import { clientHeaders } from '@/utils/auth/clientHeaders'
import { NextRequest, NextResponse } from 'next/server'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { setAuthCookies } from '../_authCookies'
import { browserSessionRedirect } from './browserSessionRedirect'

export function socialOrigin() {
    return new URL(process.env.SOCIAL_AUTH_ORIGIN || 'https://hanasand.com').origin
}
const safePath = (path: string) => path.startsWith('/') && !path.startsWith('//') && !path.split('').some(char => char === '\\' || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
const validProvider = (provider: string) => provider === 'google' || provider === 'apple'
const bindingCookie = 'hanasand_auth_binding'
const mobileChallengeCookie = (provider: string) => `__Host-social-mobile-${provider}`
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'none' as const, domain: '.hanasand.com', path: '/', maxAge: 600 }
function failure(message: string, path?: string) {
    const url = new URL('/login', socialOrigin())
    url.searchParams.set('socialError', message)
    if (path && safePath(path)) url.searchParams.set('path', path)
    const response = NextResponse.redirect(url, 303)
    response.headers.set('Cache-Control', 'no-store')
    return response
}
async function upstream(path: string, options: RequestInit = {}) {
    return fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/social/${path}`, { ...options, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) }).catch(() => null)
}
export async function start(req: NextRequest, provider: string) {
    if (!validProvider(provider)) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 })
    const link = req.method === 'POST'
    const mobileChallenge = req.nextUrl.searchParams.get('mobile_challenge')
    if (mobileChallenge !== null && !/^[A-Za-z0-9_-]{43}$/.test(mobileChallenge)) {
        return NextResponse.json({ error: 'Mobile sign-in could not be started.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    if (link && mobileChallenge) return NextResponse.json({ error: 'Mobile sign-in cannot connect another account.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    // Linking is an explicit same-origin action; never link accounts on a GET.
    if (link && (req.headers.get('origin') !== socialOrigin() || req.cookies.get('impersonation_token')?.value)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    const token = req.cookies.get('access_token')?.value
    const id = req.cookies.get('id')?.value
    const response = await upstream(`${provider}/start`, {
        method: 'POST', headers: { ...clientHeaders(req), 'Content-Type': 'application/json', ...(link && token ? { Authorization: `Bearer ${token}` } : {}), ...(link && id ? { id } : {}) },
        body: JSON.stringify({ link, redirectPath: req.nextUrl.searchParams.get('redirectPath'), ...(mobileChallenge ? { mobileChallenge } : {}) }),
    })
    const data = await response?.json().catch(() => null)
    if (!response?.ok || !data?.url) return failure(data?.error || 'Sign-in service is unavailable.', req.nextUrl.searchParams.get('redirectPath') || undefined)
    const target = new URL(data.url)
    if (target.protocol !== 'https:' || target.hostname !== (provider === 'google' ? 'accounts.google.com' : 'appleid.apple.com')) return failure('Invalid provider response.')
    const redirect = NextResponse.redirect(target, 303)
    const encodedBinding = response.headers.get('set-cookie')?.match(/(?:^|[,; ]+)hanasand_auth_binding=([^;,]+)/)?.[1]
    let binding = ''
    try { binding = decodeURIComponent(encodedBinding || '') } catch { /* Reject malformed upstream cookies. */ }
    if (!/^[A-Za-z0-9_-]{43}$/.test(binding)) return failure('Sign-in service returned an invalid browser binding.')
    redirect.cookies.set(bindingCookie, binding, cookieOptions)
    if (mobileChallenge) {
        redirect.cookies.set(mobileChallengeCookie(provider), mobileChallenge, {
            httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 600,
        })
    }
    redirect.headers.set('Cache-Control', 'no-store')
    redirect.headers.set('Referrer-Policy', 'no-referrer')
    return redirect
}
export async function callback(req: NextRequest, provider: string) {
    if (!validProvider(provider)) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 })
    let fields: URLSearchParams | FormData
    try {
        fields = req.method === 'POST' ? await req.formData() : req.nextUrl.searchParams
    } catch { return failure('Invalid sign-in response.') }
    const response = await upstream(`${provider}/callback`, {
        method: 'POST', headers: { ...clientHeaders(req), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fields.get('code'), state: fields.get('state'), binding: req.cookies.get(bindingCookie)?.value, cancelled: Boolean(fields.get('error')) }),
    })
    const data = await response?.json().catch(() => null)
    let result: NextResponse
    const mobileChallenge = req.cookies.get(mobileChallengeCookie(provider))?.value
    if (response?.ok && typeof data?.mobileCode === 'string') {
        if (!mobileChallenge || !/^[A-Za-z0-9_-]{43}$/.test(mobileChallenge) || !/^[A-Za-z0-9_-]{43}$/.test(data.mobileCode) || data.token || data.linked) {
            result = failure('Mobile sign-in could not be completed.')
        } else {
            result = NextResponse.redirect(`hanasand://social?code=${encodeURIComponent(data.mobileCode)}`, 303)
        }
    } else if (response?.ok && (data?.linked || (data?.id && data?.token))) {
        if (mobileChallenge !== undefined) {
            result = failure('Mobile sign-in could not be completed. Please start sign-in again.')
        } else {
            const path = typeof data.redirectPath === 'string' && safePath(data.redirectPath) ? data.redirectPath : '/dashboard'
            const target = new URL(path, socialOrigin())
            result = data.linked ? NextResponse.redirect(target, 303) : browserSessionRedirect(target)
            if (!data.linked) setAuthCookies(req, result, data)
        }
    } else result = failure(data?.error || 'Sign-in service is unavailable.')
    result.cookies.set(bindingCookie, '', { ...cookieOptions, maxAge: 0 })
    result.cookies.set(mobileChallengeCookie(provider), '', { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 0 })
    result.headers.set('Cache-Control', 'no-store')
    result.headers.set('Referrer-Policy', 'no-referrer')
    return result
}
export async function providers() {
    const response = await upstream('providers')
    return NextResponse.json(await response?.json().catch(() => null) || { error: 'Sign-in service is unavailable.' }, { status: response?.status || 502, headers: { 'Cache-Control': 'no-store' } })
}
export async function connections(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value || ''
    const id = req.cookies.get('id')?.value || ''
    const response = await upstream('connections', { headers: { ...clientHeaders(req), Authorization: `Bearer ${token}`, id } })
    return NextResponse.json(await response?.json().catch(() => null) || { error: 'Sign-in service is unavailable.' }, { status: response?.status || 502, headers: { 'Cache-Control': 'no-store' } })
}
