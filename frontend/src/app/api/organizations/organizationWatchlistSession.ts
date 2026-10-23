import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { backendDeviceProofTarget } from '@/utils/auth/backendDeviceProofTarget'
import tokenIsValid from '@/utils/proxy/tokenIsValid'

export type VerifiedWatchlistSession = { id: string, token: string }
const identifier = '[A-Za-z0-9_:@-]{1,200}'
const route = new RegExp(`^/organizations/(${identifier})/watchlists(?:/(${identifier}))?(?:/(actions))?$`)

export async function organizationWatchlistSession(request: NextRequest, path: string, method: string, organizationId: string): Promise<{ identity: VerifiedWatchlistSession } | { response: NextResponse }> {
    const denied = (status = 401, code = 'invalid_session') => ({ response: NextResponse.json({ error: { code, message: 'A valid watchlist request is required.' } }, { status, headers: { 'cache-control': 'no-store' } }) })
    const match = path.match(route)
    const cleanup = path === `/organizations/${organizationId}/watchlists/cleanup`
    const supported = match && match[1] === organizationId && (cleanup ? method === 'POST' : match[3] ? method === 'POST' : match[2] ? ['PUT', 'DELETE'].includes(method) : method === 'POST')
    if (!supported || method !== request.method || request.nextUrl.pathname !== `/api${path}`) return denied(400, 'invalid_watchlist_route')
    const target = backendDeviceProofTarget(request)
    if (!target) return denied()
    const jar = await cookies()
    if (jar.get('impersonation_token')?.value || request.headers.get('x-impersonation-token')) return denied()
    for (const name of request.headers.keys()) if (name.startsWith('x-hanasand-server-session-') || name === 'x-hanasand-session-validated') return denied()
    const cookieId = jar.get('id')?.value || ''
    const cookieToken = jar.get('access_token')?.value || ''
    const headerId = request.headers.get('id') || ''
    const authorization = request.headers.get('authorization') || ''
    const headerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (authorization && !headerToken || (cookieId || cookieToken) && (!cookieId || !cookieToken)
        || (headerId || headerToken) && (!headerId || !headerToken)
        || cookieId && headerId && (cookieId !== headerId || cookieToken !== headerToken)) return denied()
    const id = cookieId || headerId
    const token = cookieToken || headerToken
    if (!id || !token || token.startsWith('hsk_')) return denied()
    const body = await boundedBody(request)
    if (!body) return denied(400, 'invalid_watchlist_body')
    const fields = cleanup ? ['itemIds', 'item_ids', 'reason', 'requestId', 'request_id'] : match?.[3] ? ['action', 'reason', 'requestId', 'request_id'] : method === 'DELETE' ? ['reason', 'requestId', 'request_id'] : ['kind', 'value', 'notes', 'reason', 'requestId', 'request_id']
    if (Object.keys(body).some(name => ![...fields, 'organizationId', 'orgId', 'tenantId'].includes(name))) return denied(400, 'invalid_watchlist_body')
    for (const name of ['organizationId', 'orgId', 'tenantId']) {
        const query = request.nextUrl.searchParams.getAll(name)
        if (query.some(value => value !== organizationId) || body[name] !== undefined && body[name] !== organizationId) return denied(400, 'invalid_watchlist_scope')
    }
    const tenant = request.headers.get('x-tenant-id')
    const org = request.headers.get('x-organization-id')
    if (tenant && tenant !== organizationId || org && org !== organizationId) return denied(400, 'invalid_watchlist_scope')
    if (!process.env.VM_API_TOKEN) return denied(503, 'authentication_service_unavailable')
    const validation = await tokenIsValid(token, id, undefined, { includeInternalAccess: false, deviceProof: {
        proof: request.headers.get('dpop') || undefined, method: target.method, url: target.url,
    } })
    if (!validation.valid) return denied(validation.state === 'unavailable' ? 503 : 401, validation.state === 'unavailable' ? 'authentication_service_unavailable' : 'invalid_session')
    return { identity: { id, token } }
}

async function boundedBody(request: NextRequest): Promise<Record<string, unknown> | null> {
    const reader = request.clone().body?.getReader()
    if (!reader) return {}
    const chunks: Uint8Array[] = []
    let length = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            length += value.byteLength
            if (length > 16384) { void reader.cancel().catch(() => undefined); return null }
            chunks.push(value)
        }
        if (!length) return {}
        const bytes = new Uint8Array(length)
        let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
    } catch { return null } finally { reader.releaseLock() }
}
