import { NextRequest } from 'next/server'
import { GET as getProduct } from '@/app/api/findings/product/route'
import { GET as getCases } from '@/app/api/cases/route'
import type { DwmProductSnapshot } from '@/utils/dwm/product'

type CaseRow = { status?: string }
type OpenCasesCacheEntry = { count: number, expiresAt: number, staleUntil: number }
export type OverviewState = { status: 'ready', snapshot: DwmProductSnapshot } | { status: 'error', message: string }

const openCasesCache = new Map<string, OpenCasesCacheEntry>()
const openCasesRefreshes = new Map<string, Promise<number | null>>()
const OPEN_CASES_CACHE_TTL_MS = 10_000
const OPEN_CASES_STALE_MS = 2 * 60_000
const OPEN_CASES_CACHE_MAX_ENTRIES = 128

// Reuse the authenticated route handlers without a browser or loopback HTTP round trip.
export async function loadOverview(cookieHeader: string, organizationId?: string): Promise<OverviewState> {
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
    const request = (path: string) => new NextRequest(`http://localhost/api/${path}${query}`, { headers: { cookie: cookieHeader } })
    try {
        const snapshotResponse = await getProduct(request('dwm/product'))
        const body = await snapshotResponse.json().catch(() => null) as DwmProductSnapshot | { error?: { message?: string } } | null
        const errorMessage = body && 'error' in body ? body.error?.message : undefined
        if (!snapshotResponse.ok || !body || !('schemaVersion' in body)) throw new Error(errorMessage || 'Tenant monitoring is unavailable.')
        if (organizationId && body.tenantId !== organizationId) throw new Error('Organization monitoring returned an unexpected tenant scope.')
        return { status: 'ready', snapshot: body }
    } catch (error) {
        return { status: 'error', message: error instanceof Error ? error.message : 'Tenant monitoring is unavailable.' }
    }
}

export async function loadOpenCases(cookieHeader: string, organizationId?: string): Promise<number | null> {
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
    const request = new NextRequest(`http://localhost/api/cases${query}`, { headers: { cookie: cookieHeader } })
    const effectiveUserId = request.cookies.get('impersonating_id')?.value || request.cookies.get('id')?.value || ''
    const cacheKey = JSON.stringify([effectiveUserId, request.cookies.get('id')?.value || '', organizationId || 'personal'])
    const cached = openCasesCache.get(cacheKey)
    if (cached && cached.staleUntil > Date.now()) {
        touchOpenCases(cacheKey, cached)
        if (cached.expiresAt <= Date.now()) void refreshOpenCases(cacheKey, cookieHeader, query).catch(() => undefined)
        return cached.count
    }

    return refreshOpenCases(cacheKey, cookieHeader, query)
}

function touchOpenCases(key: string, entry: OpenCasesCacheEntry) {
    openCasesCache.delete(key)
    openCasesCache.set(key, entry)
}

async function refreshOpenCases(cacheKey: string, cookieHeader: string, query: string): Promise<number | null> {
    const pending = openCasesRefreshes.get(cacheKey)
    if (pending) return pending

    const refresh = fetchOpenCases(cacheKey, cookieHeader, query)
    openCasesRefreshes.set(cacheKey, refresh)
    try {
        return await refresh
    } finally {
        if (openCasesRefreshes.get(cacheKey) === refresh) openCasesRefreshes.delete(cacheKey)
    }
}

async function fetchOpenCases(cacheKey: string, cookieHeader: string, query: string): Promise<number | null> {
    try {
        const request = new NextRequest(`http://localhost/api/cases${query}`, { headers: { cookie: cookieHeader } })
        const casesResponse = await getCases(request).catch(() => null)
        const caseBody = casesResponse?.ok ? await casesResponse.json().catch(() => null) as { items?: CaseRow[], cases?: CaseRow[] } | null : null
        const cases = Array.isArray(caseBody?.items) ? caseBody.items : Array.isArray(caseBody?.cases) ? caseBody.cases : null
        if (!cases) return null
        const count = cases.filter(row => !['closed', 'resolved', 'false_positive', 'suppressed'].includes(String(row.status || '').toLowerCase())).length
        const now = Date.now()
        touchOpenCases(cacheKey, { count, expiresAt: now + OPEN_CASES_CACHE_TTL_MS, staleUntil: now + OPEN_CASES_STALE_MS })
        while (openCasesCache.size > OPEN_CASES_CACHE_MAX_ENTRIES) openCasesCache.delete(openCasesCache.keys().next().value!)
        return count
    } catch {
        return null
    }
}
