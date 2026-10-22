import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import config from '@/config'
import { authCookieOptions, setAuthCookie } from '@/utils/proxy/authResponses'
import { applyOrganizationId, backendTargetBase } from '@/utils/proxy/backendTarget'
import { vmCreateProxyTimeoutMs, vmCreateTimeoutMessage, vmLifecycleProxyTimeoutMs, vmSetupPlanProxyTimeoutMs } from '@/utils/vms/proxyTimeout'

type Context = {
    params: Promise<{ path?: string[] }>
}

const hopByHopHeaders = new Set([
    'connection',
    'content-encoding',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
])

const BACKEND_PROXY_TIMEOUT_MS = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 12_000)

async function handler(req: NextRequest, context: Context) {
    const cookieStore = await cookies()
    // Prefer credentials explicitly sent for this request. Client-side AI calls
    // keep refreshed credentials in document.cookie and send them as headers;
    // a duplicate or older cookie must not override that current session.
    const token = bearerToken(req.headers.get('authorization')) || cookieStore.get('access_token')?.value || ''
    const id = req.headers.get('id') || cookieStore.get('id')?.value || ''

    const params = await context.params
    const pathSegments = params.path || []
    if (pathSegments[0] === 'browser' || pathSegments[0] === 'browser-stream') return NextResponse.json({ error: 'Browser is served by the standalone Browsers API.' }, { status: 410 })
    const anonymousAllowed = (pathSegments[0] === 'logs' && pathSegments[1] === 'metrics' && pathSegments[2] === 'public')
    if ((!token || !id) && !anonymousAllowed) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const path = pathSegments.map(segment => encodeURIComponent(segment)).join('/')
    const impersonationToken = cookieStore.get('impersonation_token')?.value
    const routing = backendTargetBase(pathSegments, config.url.api, config.url.ai, process.env.FRONTEND_LOGS_API_URL, !impersonationToken)
    const targetBase = routing.url
    const target = new URL(`${targetBase}/${path}`)
    target.search = req.nextUrl.search
    const longLogSearch = pathSegments[0] === 'logs' && pathSegments[1] === 'search'
        && (target.searchParams.get('search')?.trim().length || 0) >= 12
    const rulePreview = req.method === 'POST' && pathSegments[0] === 'rules' && pathSegments[1] === 'preview'
    const vmLifecycleTimeout = vmLifecycleProxyTimeoutMs(req.method, pathSegments, BACKEND_PROXY_TIMEOUT_MS)
    const vmSetupPlanTimeout = vmSetupPlanProxyTimeoutMs(req.method, pathSegments, BACKEND_PROXY_TIMEOUT_MS)
    const vmCreateTimeout = vmCreateProxyTimeoutMs(req.method, pathSegments, BACKEND_PROXY_TIMEOUT_MS)
    if (['events', 'rules'].includes(pathSegments[0]) && !target.searchParams.has('organizationId')) {
        const organizationId = await activeOrganizationId()
        if (organizationId) target.searchParams.set('organizationId', organizationId)
    }
    if (routing.directLogsRead && !target.searchParams.has('organizationId')) {
        const organizationId = await activeOrganizationId()
        applyOrganizationId(target, organizationId)
    }

    const headers = new Headers()
    req.headers.forEach((value, key) => {
        const lower = key.toLowerCase()
        if (!hopByHopHeaders.has(lower) && lower !== 'authorization' && lower !== 'cookie' && lower !== 'id' && !lower.startsWith('x-impersonation')) {
            headers.set(key, value)
        }
    })
    // The device proof is signed for the browser-facing Next route. Preserve
    // that request target when forwarding it to the API service, whose URL is
    // different behind this proxy.
    headers.set('x-device-proof-url', `${req.nextUrl.origin}${req.nextUrl.pathname}`)
    headers.set('x-device-proof-method', req.method)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (id) headers.set('id', id)
    if (['notes', 'share', 'article', 'articles', 'thought', 'thoughts'].includes(pathSegments[0])) {
        headers.delete('x-organization-id')
        const organizationId = await activeOrganizationId()
        if (organizationId) headers.set('x-organization-id', organizationId)
    }
    if (pathSegments[0] === 'vm' || pathSegments[0] === 'vms') {
        headers.delete('x-organization-id')
        const organizationId = await activeOrganizationId()
        if (organizationId) headers.set('x-organization-id', organizationId)
    }

    if (impersonationToken) {
        headers.set('x-impersonation-token', impersonationToken)
    }

    let response: Response
    try {
        const body = req.method === 'GET' || req.method === 'HEAD' || !req.headers.has('content-type') ? undefined : req.body
        response = await fetch(target, {
            method: req.method,
            headers,
            body,
            duplex: 'half',
            cache: 'no-store',
            signal: AbortSignal.timeout(Math.max(
                BACKEND_PROXY_TIMEOUT_MS,
                longLogSearch || rulePreview ? 120_000 : 0,
                vmLifecycleTimeout || 0,
                vmSetupPlanTimeout || 0,
                vmCreateTimeout || 0,
            )),
        } as RequestInit & { duplex: 'half' })
    } catch (error) {
        const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        return NextResponse.json({
            error: isTimeout
                ? vmCreateTimeout ? vmCreateTimeoutMessage : 'The backend service did not respond in time. Try again shortly; the dashboard is still available.'
                : 'The backend service is unavailable right now. Try again shortly.',
        }, { status: 503 })
    }

    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
        const lower = key.toLowerCase()
        if (!hopByHopHeaders.has(lower) && lower !== 'set-cookie' && lower !== 'x-access-token' && lower !== 'x-access-token-expires-at') {
            responseHeaders.set(key, value)
        }
    })

    const next = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    })

    const refreshedToken = response.headers.get('x-access-token')
    if (refreshedToken) {
        const { sharedDomain, ...cookieOptions } = authCookieOptions(req)
        setAuthCookie(next, 'access_token', refreshedToken, {
            ...cookieOptions,
            expires: response.headers.get('x-access-token-expires-at')
                ? new Date(response.headers.get('x-access-token-expires-at') as string)
                : undefined,
        }, sharedDomain)
        const { createHash } = await import('node:crypto')
        next.headers.set('x-device-proof-token-hash', createHash('sha256').update(refreshedToken).digest('base64url'))
    }

    return next
}

function bearerToken(value: string | null) {
    if (!value?.startsWith('Bearer ')) {
        return ''
    }

    return value.slice('Bearer '.length).trim()
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
