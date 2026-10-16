import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { parseJsonObject, resolveDwmRequestScope, withDwmRequestScope } from './dwmScope'
import { serveDwmProductSnapshot } from './dwmProductSnapshotCache'
import { verifyDwmOrganizationScope } from './verifyDwmOrganizationScope'

export { resolveDwmRequestScope, withDwmRequestScope } from './dwmScope'
export { presentedApiKey, proxyApiTiRequest } from './tiApiKeyProxy'

type ProxyOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    timeoutMs?: number
}

export async function proxyTiRequest(request: NextRequest, path: string, options: ProxyOptions = {}) {
    const session = await requireApiSession(request)
    if ('response' in session) return session.response

    const base = tiScraperApiBase()
    if (!base) {
        return NextResponse.json({ error: { code: 'ti_backend_unavailable', message: 'TI backend is not configured.' } }, { status: 503 })
    }

    try {
        const cookieStore = await cookies()
        const { token, id } = session.identity
        const actorId = id
        const impersonationToken = cookieStore.get('impersonation_token')?.value || request.headers.get('x-impersonation-token') || ''
        const method = options.method || request.method as 'GET' | 'POST' | 'PATCH'
        const requestText = method === 'GET' ? '' : await request.text()
        const body = requestText ? parseJsonObject(requestText) : {}
        if (requestText && !body) {
            return NextResponse.json({ error: { code: 'invalid_json', message: 'A JSON request body is required.' } }, { status: 400 })
        }
        const scope = resolveDwmRequestScope({ identityId: id, params: request.nextUrl.searchParams, headers: request.headers, body: body || {}, fallbackOrganizationId: await activeOrganizationId() })
        if (scope.error) {
            return NextResponse.json({ error: { code: 'invalid_scope', message: scope.error } }, { status: 400 })
        }
        if (scope.organizationId) {
            const scopeError = await verifyDwmOrganizationScope(scope.organizationId, token, id, impersonationToken)
            if (scopeError) return scopeError
        }
        const target = new URL(path, base)
        for (const [key, value] of request.nextUrl.searchParams.entries()) {
            if (key === 'org' || key === 'tenantId' || key === 'organizationId' || key === 'orgId') continue
            target.searchParams.set(key, value)
        }
        target.searchParams.set('tenantId', scope.tenantId)
        if (scope.organizationId) target.searchParams.set('organizationId', scope.organizationId)

        const init: RequestInit = {
            method,
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-tenant-id': scope.tenantId,
                ...(scope.organizationId ? { 'x-organization-id': scope.organizationId } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(id ? { id } : {}),
                ...(actorId ? { 'x-actor-id': actorId, 'x-user-id': actorId } : {}),
                ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
            },
            signal: AbortSignal.timeout(options.timeoutMs ?? 12000),
        }

        if (method !== 'GET') {
            init.body = JSON.stringify(withDwmRequestScope(body || {}, scope))
        }

        if (method === 'GET' && path.replace(/^\/+/, '') === 'v1/dwm/product') {
            return await serveDwmProductSnapshot(target, init)
        }

        const response = await fetch(target, init)
        const text = await response.text()
        const payload = text ? JSON.parse(text) as unknown : {}
        return NextResponse.json(payload, { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch (error) {
        return NextResponse.json({
            error: {
                code: 'ti_proxy_failed',
                message: error instanceof Error ? error.message : String(error),
            },
        }, { status: 502 })
    }
}
