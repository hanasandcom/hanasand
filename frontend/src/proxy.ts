import { recoveryReadOnly } from '../../api/src/utils/recovery'
import { appPagePath, canonicalAppPath } from './utils/routes/appRoutes'
import { NextRequest, NextResponse } from 'next/server'
import pathIsAllowedWhileUnauthorized from './utils/proxy/pathIsAllowedWhileUnauthorized'
import tokenIsValid from './utils/proxy/tokenIsValid'
import organizationProtectedPaths from './utils/proxy/organizationProtectedPaths'
import { applyRefreshedAuthCookies, authCookieOptions, authServiceUnavailable, isLocalDashboardRenderProof, loginRedirect, requestHostname, type TokenRefreshCookies } from './utils/proxy/authResponses'
import { identityAuthUrl } from './utils/auth/identityRedirect'

export async function proxy(req: NextRequest) {
    if (['GET', 'HEAD'].includes(req.method)) {
        const pathname = req.nextUrl.pathname
        if (pathname === '/login' || pathname === '/signup' || pathname === '/register') {
            const page = pathname === '/login' && req.nextUrl.searchParams.get('mode') !== 'signup'
                ? 'login'
                : 'signup'
            return NextResponse.redirect(identityAuthUrl(page, req.nextUrl.searchParams.get('path')), 307)
        }
    }
    if (/^\/sandbox\/login\/?$/.test(req.nextUrl.pathname)) {
        return new NextResponse('Not Found', {
            status: 404,
            headers: {
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    }
    const recoveryAllowedPost = req.method === 'POST' && req.nextUrl.pathname === '/api/pwned'
    if (!recoveryAllowedPost && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && recoveryReadOnly()) {
        return NextResponse.json({ error: { code: 'recovery_read_only', message: 'Changes are paused during database recovery. Existing records remain available for viewing.' } }, { status: 503, headers: { 'retry-after': '30', 'cache-control': 'no-store' } })
    }
    const tokenCookie = req.cookies.get('access_token')
    const idCookie = req.cookies.get('id')
    const visiblePath = req.nextUrl.pathname
    const canonicalPath = canonicalAppPath(visiblePath)
    if (canonicalPath !== visiblePath) {
        const url = req.nextUrl.clone()
        url.pathname = canonicalPath
        return NextResponse.redirect(url, 308)
    }
    const path = appPagePath(visiblePath)
    const pathWithSearch = `${visiblePath}${req.nextUrl.search}`
    const strictPath = path === '/dashboard/management/organizations'
        ? undefined
        : organizationProtectedPaths.find(protectedPath => path.startsWith(protectedPath))
    if ((path === '/profile' || path.startsWith('/profile/'))
        && (!tokenCookie?.value || !idCookie?.value)) {
        if (/^\/profile\/[^/]+\/ssh-keys\/?$/.test(visiblePath)) {
            return loginRedirect(req, pathWithSearch, { internal: true })
        }
        return NextResponse.rewrite(new URL('/_not-found', req.url), {
            headers: { 'Cache-Control': 'private, no-store' },
        })
    }
    const requestHeaders = new Headers(req.headers)
    for (const header of [
        'x-hanasand-session-validated', 'x-hanasand-session-id', 'x-hanasand-session-token',
        'x-hanasand-session-can-view-internal', 'x-hanasand-session-can-edit-internal',
        'x-hanasand-session-name', 'x-hanasand-session-avatar', 'x-hanasand-session-expires-at',
    ]) requestHeaders.delete(header)
    const theme = req.cookies.get('theme')?.value || 'dark'
    const impersonationToken = req.cookies.get('impersonation_token')?.value || ''
    const impersonatingId = req.cookies.get('impersonating_id')?.value || ''
    const impersonatingName = req.cookies.get('impersonating_name')?.value || ''
    const requiresAuth = !pathIsAllowedWhileUnauthorized(path)

    if ((path === '/dev' || path.startsWith('/dev/')) && requestHostname(req).endsWith('hanasand.com')) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    requestHeaders.set('x-theme', theme)
    requestHeaders.set('x-current-path', visiblePath)
    if (impersonationToken) {
        requestHeaders.set('x-impersonation-token', impersonationToken)
    }
    if (impersonatingId) {
        requestHeaders.set('x-impersonating-id', impersonatingId)
        requestHeaders.set('x-impersonating-name', impersonatingName || impersonatingId)
    }

    // Page aliases are relative rewrites in next.config.js. Middleware URLs can
    // normalize a loopback host and accidentally turn them into external HTTPS requests.
    let response: NextResponse | undefined
    const refreshedCookieOptions = authCookieOptions(req)
    let refreshedAuth: TokenRefreshCookies | null = null

    if (requiresAuth) {
        if (!tokenCookie || !idCookie) {
            return loginRedirect(req, pathWithSearch)
        }

        const token = tokenCookie.value
        const id = idCookie.value
        let canViewOrganizationInternalPages = isLocalDashboardRenderProof(req, token, id)
        if (!canViewOrganizationInternalPages) {
            const auth = await tokenIsValid(token, id, impersonationToken || undefined, {
                includeInternalAccess: Boolean(strictPath),
                deviceProof: {
                    proof: req.headers.get('dpop') || undefined,
                    method: req.headers.get('x-device-proof-method') || req.method,
                    url: req.headers.get('x-device-proof-url') || req.url,
                },
            })

            if (auth.state === 'unavailable') {
                return authServiceUnavailable(req)
            } else if (auth.state === 'invalid') {
                return loginRedirect(req, pathWithSearch, { expired: Boolean(token), clearAuth: true })
            }

            if (auth.servicePages) {
                response = NextResponse.next({ request: { headers: requestHeaders } })
                const canLoadDatabaseQueries = canonicalPath === '/api/db/queries'
                    && req.method === 'GET'
                    && auth.servicePages.includes('/db')
                if (!['GET', 'HEAD'].includes(req.method) || (!auth.servicePages.includes(canonicalPath) && !canLoadDatabaseQueries)) {
                    return NextResponse.json({ error: 'This service account cannot access this page or action.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
                }
                return response
            }

            // Proxy has verified this request's one-use device proof. Pass the
            // verified session details to the server components for this same
            // request so they do not replay the proof to Identity.
            requestHeaders.set('x-hanasand-session-validated', '1')
            requestHeaders.set('x-hanasand-session-id', id)
            requestHeaders.set('x-hanasand-session-token', token)
            requestHeaders.set('x-hanasand-session-can-view-internal', auth.canViewInternalPages === true ? '1' : '0')
            requestHeaders.set('x-hanasand-session-can-edit-internal', auth.canEditInternalPages === true ? '1' : '0')
            requestHeaders.set('x-hanasand-session-name', auth.name || '')
            requestHeaders.set('x-hanasand-session-avatar', auth.avatar || '')
            requestHeaders.set('x-hanasand-session-expires-at', auth.expires_at || '')
            response = NextResponse.next({ request: { headers: requestHeaders } })

            if (auth.token) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    id,
                    token: auth.token,
                    expires_at: auth.expires_at,
                    checked_at: new Date().toISOString(),
                }
            }

            canViewOrganizationInternalPages = auth.canViewInternalPages === true

            if (auth.name) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    name: auth.name,
                    expires_at: auth.expires_at,
                    checked_at: new Date().toISOString(),
                }
            }

            if (auth.avatar !== undefined) {
                refreshedAuth = {
                    ...(refreshedAuth ?? {}),
                    avatar: auth.avatar,
                    expires_at: auth.expires_at,
                    checked_at: new Date().toISOString(),
                }
            }

            applyRefreshedAuthCookies(response, refreshedCookieOptions, refreshedAuth)
        }

        // This page enforces organization membership on the server and in its API.
        if (strictPath) {
            if (!canViewOrganizationInternalPages) {
                const url = new URL('/dashboard', req.url)
                url.searchParams.set('notAllowed', 'true')
                url.searchParams.set('from', pathWithSearch)
                const redirectResponse = NextResponse.redirect(url)
                applyRefreshedAuthCookies(redirectResponse, refreshedCookieOptions, refreshedAuth)
                return redirectResponse
            }
        }
    }

    response ??= NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('x-theme', theme)
    response.headers.set('x-current-path', visiblePath)
    if (requestHeaders.get('x-auth-state')) {
        response.headers.set('x-auth-state', requestHeaders.get('x-auth-state')!)
    }
    return response
}
