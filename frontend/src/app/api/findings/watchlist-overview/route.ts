import { NextRequest, NextResponse } from 'next/server'
import { GET as getCases } from '@/app/api/cases/route'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { proxyTiRequest } from '@/app/api/findings/_tiProxy'

export const dynamic = 'force-dynamic'

type CachedOrganizationCounts = {
    caseCount: number
    destinationsCount: number
    expiresAt: number
}

const organizationCountsCache = new Map<string, CachedOrganizationCounts>()
const ORGANIZATION_COUNTS_CACHE_TTL_MS = 30_000

export async function GET(request: NextRequest) {
    const overviewResponse = await proxyTiRequest(request, '/v1/dwm/watchlists/overview', { method: 'GET', timeoutMs: 5_000 })
    if (!overviewResponse.ok) return overviewResponse

    const overview = await overviewResponse.json() as {
        tenantId: string
        organizationId?: string
        watchlists: Array<{ id: string, name: string, terms: Array<{ id?: string, kind: string, value: string }>, status: string }>
        watchlistCount: number
        watchedTermCount: number
        findingsCount: number
    }
    const cacheKey = `${overview.tenantId}\u0000${overview.organizationId ?? ''}`
    const cachedCounts = organizationCountsCache.get(cacheKey)
    if (cachedCounts && cachedCounts.expiresAt > Date.now()) {
        return NextResponse.json({ ...overview, caseCount: cachedCounts.caseCount, destinationsCount: cachedCounts.destinationsCount }, { headers: { 'cache-control': 'private, no-store' } })
    }

    const casesUrl = new URL(request.url)
    casesUrl.pathname = '/api/cases'
    casesUrl.searchParams.set('summary', 'true')
    const casesRequest = new NextRequest(casesUrl, { headers: request.headers })
    const destinationScopeId = overview.organizationId || overview.tenantId
    const [casesResponse, destinationsResponse] = await Promise.all([
        getCases(casesRequest),
        proxyOrganizationApiRequest(request, `/dwm/webhook-destinations?orgId=${encodeURIComponent(destinationScopeId)}`, { method: 'GET' })
    ])

    const casesPayload = await casesResponse.json().catch(() => ({})) as { total?: number, warnings?: string[] }
    const destinationsPayload = await destinationsResponse.json().catch(() => ({})) as { destinations?: Array<{ status?: string }> }
    const caseCount = casesResponse.ok && !casesPayload.warnings?.length && Number.isFinite(Number(casesPayload.total))
        ? Number(casesPayload.total)
        : undefined
    const destinationsCount = destinationsResponse.ok && Array.isArray(destinationsPayload.destinations)
        ? destinationsPayload.destinations.filter(destination => destination.status !== 'archived').length
        : undefined

    if (caseCount !== undefined && destinationsCount !== undefined && !casesPayload.warnings?.length) {
        organizationCountsCache.set(cacheKey, {
            caseCount,
            destinationsCount,
            expiresAt: Date.now() + ORGANIZATION_COUNTS_CACHE_TTL_MS
        })
        while (organizationCountsCache.size > 128) {
            const oldestKey = organizationCountsCache.keys().next().value
            if (oldestKey === undefined) break
            organizationCountsCache.delete(oldestKey)
        }
    }

    return NextResponse.json({ ...overview, caseCount, destinationsCount }, { headers: { 'cache-control': 'private, no-store' } })
}
