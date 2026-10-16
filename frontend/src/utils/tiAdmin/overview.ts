import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import type { ApiPayload } from './values'
import type { TiAdminCapture, TiAdminOverview, TiAdminRun, TiAdminSource } from './types'
import { emptyResource, fetchResource } from './resources'
import { domainsFromCaptures, toCapture } from './captureMapping'
import { toSource } from './sourceMapping'
import { toRun } from './runMapping'
import { numberValue, objectValue } from './values'

export async function getTiAdminOverview(tenantId: string | null = 'default', page: { page?: number, limit?: number, sourceId?: string, includeSamples?: boolean, includeCandidates?: boolean, query?: string, family?: string, lifecycle?: string, access?: string, health?: string, output?: string, matches?: string, sort?: string, direction?: string } = {}): Promise<TiAdminOverview> {
    const base = tiScraperApiBase()
    const sampleFilter = page.sourceId ? { query: page.sourceId } : {}
    const resources = await Promise.all([
        page.includeSamples === false ? emptyResource('captures') : fetchResource(base, '/v1/intel/captures', 'captures', tenantId, { ...sampleFilter, limit: Math.min(page.limit || 50, 50) }),
        page.includeSamples === false ? emptyResource('collection-runs') : fetchResource(base, '/v1/intel/collection-runs', 'collectionRuns', tenantId, { ...sampleFilter, limit: Math.min(page.limit || 50, 50) }),
        fetchResource(base, '/v1/intel/source-operations', 'sources', tenantId, {
            page: page.page,
            limit: Math.max(1, Math.min(500, page.limit || 25)),
            sourceId: page.sourceId,
            includeCandidates: Boolean(page.sourceId) || page.includeCandidates === true,
            query: page.query,
            family: page.family,
            lifecycle: page.lifecycle,
            access: page.access,
            health: page.health,
            output: page.output,
            matches: page.matches,
            sort: page.sort,
            direction: page.direction,
        }),
    ])
    const [captureResult, runResult, operationsResult] = resources
    const rawCaptures = captureResult.records
    const captures = rawCaptures.map(toCapture).filter((row): row is TiAdminCapture => Boolean(row))
    const sources = operationsResult.records
        .map(row => toSource(row, row, captures))
        .filter((row): row is TiAdminSource => Boolean(row))
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const runs = runResult.records.map(row => toRun(row, sourceById)).filter((row): row is TiAdminRun => Boolean(row))

    return {
        sources,
        domains: domainsFromCaptures(captures),
        captures: captures.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt)),
        runs: runs.sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
        availability: {
            state: resources.every(result => result.ok) ? 'live' : 'degraded',
            failedResources: resources.filter(result => !result.ok).map(result => result.resource),
        },
        sourcePage: {
            total: operationsResult.total,
            page: page.page || 1,
            limit: Math.max(1, Math.min(500, page.limit || 25)),
            nextCursor: operationsResult.nextCursor,
            previousCursor: operationsResult.previousCursor,
        },
        sourceTotals: sourceTotals(operationsResult.payload),
    }
}

export async function getTiAdminSource(id: string, tenantId: string | null = 'default') {
    return (await getTiAdminOverview(tenantId, { sourceId: id })).sources[0] || null
}

export async function getTiCollectionRunsPage(tenantId: string | null = null, page: { page?: number, limit?: number } = {}) {
    const result = await fetchResource(tiScraperApiBase(), '/v1/intel/collection-runs', 'collectionRuns', tenantId, { page: page.page, limit: Math.max(1, Math.min(100, page.limit || 50)) })
    const runs = result.records.map(row => toRun(row, new Map())).filter((row): row is TiAdminRun => Boolean(row))
    return { runs, total: result.total, nextCursor: result.nextCursor, previousCursor: result.previousCursor, available: result.ok }
}

export function sourceRuns(overview: TiAdminOverview, sourceId: string) {
    return overview.runs.filter(run => run.sourceId === sourceId)
}

export function sourceCaptures(overview: TiAdminOverview, sourceId: string) {
    return overview.captures.filter(capture => capture.sourceId === sourceId)
}

export function domainCaptures(overview: TiAdminOverview, domain: string) {
    return overview.captures.filter(capture => capture.domain === domain)
}

export function sourceById(overview: TiAdminOverview, id: string) {
    return overview.sources.find(source => source.id === id)
}

const tiDateFormatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Oslo',
})

export function formatTiDate(value: string) {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return 'not recorded'
    return tiDateFormatter.format(date)
}

export function ageDays(since: string) {
    const diff = Date.now() - new Date(since).getTime()
    return Number.isFinite(diff) ? Math.max(1, Math.round(diff / 86400000)) : 0
}

function sourceTotals(payload: ApiPayload): TiAdminOverview['sourceTotals'] {
    const summary = objectValue(payload.summary)
    const counts = objectValue(objectValue(payload.qualification).counts)
    return {
        configured: numberValue(summary.sourceCount),
        executable: numberValue(summary.retainedSourceCount, summary.activeSourceCount),
        active: numberValue(summary.activeSourceCount),
        qualifying: numberValue(counts.total),
        qualifyingClearWeb: numberValue(counts.clearWeb),
        qualifyingLawfulDarkWeb: numberValue(counts.lawfulDarkWeb),
        qualifyingPublicTelegram: numberValue(counts.publicTelegram),
    }
}
