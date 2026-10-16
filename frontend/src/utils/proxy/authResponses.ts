import { NextRequest, NextResponse } from 'next/server'

export type TokenRefreshCookies = {
    token?: string
    name?: string
    avatar?: string
    expires_at?: string
    checked_at?: string
}

type AuthCookieWriteOptions = {
    sameSite: 'lax'
    path: string
    secure: boolean
    expires: Date | undefined
}

export function applyRefreshedAuthCookies(
    response: NextResponse,
    options: ReturnType<typeof authCookieOptions>,
    auth: TokenRefreshCookies | null,
) {
    if (!auth) {
        return
    }

    const cookieOptions = {
        sameSite: options.sameSite,
        path: options.path,
        secure: options.secure,
        expires: auth.expires_at ? new Date(auth.expires_at) : undefined,
    }

    if (auth.token) {
        setAuthCookie(response, 'access_token', auth.token, cookieOptions, options.sharedDomain)
    }
    if (auth.name) {
        setAuthCookie(response, 'name', auth.name, cookieOptions, options.sharedDomain)
    }
    if (auth.avatar !== undefined) {
        setAuthCookie(response, 'avatar', auth.avatar, cookieOptions, options.sharedDomain)
    }
    if (auth.expires_at) {
        setAuthCookie(response, 'session_expires_at', auth.expires_at, cookieOptions, options.sharedDomain)
    }
    if (auth.checked_at) {
        setAuthCookie(response, 'auth_checked_at', auth.checked_at, cookieOptions, options.sharedDomain)
    }
}

export function setAuthCookie(
    response: NextResponse,
    name: string,
    value: string,
    options: AuthCookieWriteOptions,
    sharedDomain: string | null,
) {
    response.cookies.set(name, value, options)
    if (sharedDomain) {
        response.cookies.set(name, value, {
            ...options,
            domain: sharedDomain,
        })
    }
}

export function authCookieOptions(req: NextRequest) {
    return {
        sameSite: 'lax' as const,
        path: '/',
        secure: req.nextUrl.protocol === 'https:' || requestHostname(req).endsWith('hanasand.com'),
        sharedDomain: requestHostname(req).endsWith('hanasand.com') ? '.hanasand.com' : null,
    }
}

export function requestHostname(req: NextRequest) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.hostname
    return host.split(':')[0]
}

export function isLocalDashboardRenderProof(req: NextRequest, token: string, id: string) {
    const host = requestHostname(req)
    const loopbackHost = host === '127.0.0.1' || host === 'localhost' || host === '::1'
    return loopbackHost
        && req.headers.get('x-hanasand-render-proof-auth') === 'local-dashboard-render-proof'
        && token === 'local-dashboard-render-proof-token'
        && id === 'dashboard-render-proof-user'
}

export function loginRedirect(
    req: NextRequest,
    path: string,
    options: { expired?: boolean, internal?: boolean, notAllowed?: boolean, clearAuth?: boolean } = {},
) {
    const url = new URL('/login', req.url)
    url.searchParams.set('path', path)
    if (options.internal) {
        url.searchParams.set('internal', '1')
    }
    if (options.expired) {
        url.searchParams.set('expired', 'true')
    }
    if (options.notAllowed) {
        url.searchParams.set('notAllowed', 'true')
    }

    const response = NextResponse.redirect(url)
    if (options.clearAuth) {
        const authCookies = ['name', 'access_token', 'id', 'avatar', 'session_expires_at', 'auth_checked_at', 'roles']
        for (const cookie of authCookies) {
            response.cookies.delete(cookie)
        }
        const secure = req.nextUrl.protocol === 'https:' || requestHostname(req).endsWith('hanasand.com') ? '; Secure' : ''
        for (const cookie of authCookies) {
            response.headers.append('Set-Cookie', `${cookie}=; Path=/; Domain=.hanasand.com; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`)
        }
    }

    return response
}

export function authServiceUnavailable(req: NextRequest) {
    const headers = { 'cache-control': 'no-store', 'retry-after': '3' }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return NextResponse.json({
            ok: false,
            error: { code: 'authentication_service_unavailable', message: 'Authentication service is temporarily unavailable.' },
        }, { status: 503, headers })
    }

    const retryPath = `${req.nextUrl.pathname}${req.nextUrl.search}`.replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;',
    })[character]!)
    const dark = req.cookies.get('theme')?.value === 'dark'
    // Page requests (including Next client navigation) get a retryable document,
    // never a raw API envelope or unverified protected content.
    return new NextResponse(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta http-equiv="refresh" content="3">
<title>Reconnecting</title>
<style>
            :root{color-scheme:${dark ? 'dark' : 'light'};--ui-canvas:${dark ? '#070707' : '#f5f5f5'};--ui-panel:${dark ? '#101010' : '#ffffff'};--ui-border:${dark ? '#383838' : '#d4d4d4'};--ui-text:${dark ? '#f5f7fb' : '#171a21'};--ui-muted:${dark ? '#999999' : '#4d4d4d'};--ui-primary:${dark ? '#f5f7fb' : '#22252b'};--ui-loader:#8b0000;--ui-on-primary:${dark ? '#101010' : '#ffffff'}}
            body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--ui-canvas);color:var(--ui-text);font:16px/1.6 system-ui,sans-serif}
            main{max-width:28rem;margin:1.5rem;padding:2rem;border:1px solid var(--ui-border);border-radius:12px;background:var(--ui-panel)}
            .brand{display:flex;align-items:center;gap:.75rem;margin:0 0 1.5rem;color:var(--ui-muted);font-size:1.25rem;line-height:1.3}
            .brand img{width:2.25rem;height:2.25rem;object-fit:contain;flex:none}
            h1{font-size:1.5rem;line-height:1.3}p{color:var(--ui-muted)}
            a{display:inline-block;margin-top:.5rem;padding:.6rem 1rem;border-radius:6px;background:var(--ui-primary);color:var(--ui-on-primary);text-decoration:none;font-weight:600}a:focus-visible{outline:3px solid var(--ui-primary);outline-offset:3px}
</style></head><body><main>
<div class="brand"><img src="/hanasand-logo-transparent.png" alt="" width="36" height="36"><span>Hanasand</span></div><h1>Reconnecting</h1>
<p role="status">Unable to authenticate. Trying again in a few seconds.</p>
<a href="${retryPath}">Try again now</a>
</main></body></html>`, { status: 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } })
}
