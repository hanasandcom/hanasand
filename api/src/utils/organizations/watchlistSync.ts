export const WATCHLIST_PROJECTION_RECEIPT = 'organization.watchlist_projection_receipt.v1' as const
export type WatchlistProjectionReceipt = {
    schemaVersion: typeof WATCHLIST_PROJECTION_RECEIPT
    organizationId: string
    itemIds: string[]
    projection: {
        status: 'synchronized' | 'unchanged' | 'pending' | 'failed'
        checkedAt: string | null
        source: 'identity'
        watchlistIds: string[]
        unresolvedItemIds: string[]
        reason?: 'no_changed_items'
        error?: { code: string, message: string }
    }
    alertRebuild: { status: 'not_requested', reason: 'projection_only' }
}

type SyncOptions = { base?: string, token?: string, fetchImpl?: typeof fetch, timeoutMs?: number }
export const isWatchlistProjectionId = (value: string) => /^[A-Za-z0-9_.:@-]{1,200}$/.test(value) && value !== '.' && value !== '..'

export async function savedWatchlistProjection(organizationId: string, itemIds: string[], options: SyncOptions = {}) {
    return { saved: true as const, dwmAlertBridge: await syncWatchlistProjection(organizationId, itemIds, options) }
}

export async function syncWatchlistProjection(organizationId: string, itemIds: string[], options: SyncOptions = {}): Promise<WatchlistProjectionReceipt> {
    const receipt: WatchlistProjectionReceipt = {
        schemaVersion: WATCHLIST_PROJECTION_RECEIPT, organizationId, itemIds: [...new Set(itemIds)],
        projection: { status: 'pending', checkedAt: null, source: 'identity', watchlistIds: [], unresolvedItemIds: [] },
        alertRebuild: { status: 'not_requested', reason: 'projection_only' },
    }
    const failure = (status: 'pending' | 'failed', code: string): WatchlistProjectionReceipt => ({ ...receipt,
        projection: { ...receipt.projection, status, error: { code, message: 'The watchlist was saved; monitoring projection synchronization did not complete.' } },
    })
    if (!isWatchlistProjectionId(organizationId) || receipt.itemIds.length > 50 || receipt.itemIds.some(id => !isWatchlistProjectionId(id))) return failure('failed', 'invalid_projection_scope')
    if (!receipt.itemIds.length) return { ...receipt, projection: { ...receipt.projection, status: 'unchanged', reason: 'no_changed_items' } }
    const base = (options.base ?? process.env.TI_SCRAPER_API_BASE)?.trim()
    const token = (options.token ?? process.env.TI_SCRAPER_SERVICE_TOKEN)?.trim()
    if (!base || !token) return failure('pending', 'projection_unavailable')
    try {
        const configured = new URL(base)
        if (!['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password || configured.search || configured.hash) return failure('failed', 'projection_configuration_invalid')
        const response = await (options.fetchImpl ?? fetch)(new URL('/v1/internal/organization-watchlists/reconcile', configured), {
            method: 'POST', cache: 'no-store', redirect: 'error',
            headers: { 'content-type': 'application/json', 'x-hanasand-service-token': token, 'x-organization-id': organizationId, 'x-tenant-id': organizationId },
            body: JSON.stringify({ organizationId, itemIds: receipt.itemIds }),
            signal: AbortSignal.timeout(Math.max(1, Math.min(options.timeoutMs ?? 2000, 2000))),
        })
        if (!response.ok) {
            const partial = failure(response.status >= 500 || response.status === 429 ? 'pending' : 'failed', `projection_http_${response.status}`)
            if (response.status === 409) {
                const text = await response.text()
                if (text.length <= 65536) {
                    try {
                        const body = JSON.parse(text) as { projection?: { unresolvedItemIds?: unknown } }
                        const ids = body?.projection?.unresolvedItemIds
                        if (Array.isArray(ids)) partial.projection.unresolvedItemIds = [...new Set(ids.filter((id): id is string => typeof id === 'string' && receipt.itemIds.includes(id)))]
                    } catch { /* Preserve the known saved outcome without trusting an invalid error body. */ }
                }
            }
            return partial
        }
        const text = await response.text()
        if (text.length > 65536) return failure('failed', 'projection_receipt_invalid')
        let parsed: unknown
        try { parsed = JSON.parse(text) } catch { return failure('failed', 'projection_receipt_invalid') }
        if (!isProjectionReceipt(parsed, receipt)) return failure('failed', 'projection_receipt_invalid')
        return { ...receipt, projection: {
            status: parsed.projection.status, checkedAt: parsed.projection.checkedAt, source: 'identity',
            watchlistIds: [...new Set(parsed.projection.watchlistIds)], unresolvedItemIds: [],
        } }
    } catch {
        return failure('pending', 'projection_unavailable')
    }
}

function isProjectionReceipt(value: unknown, expected: WatchlistProjectionReceipt): value is WatchlistProjectionReceipt {
    if (!value || typeof value !== 'object') return false
    const row = value as WatchlistProjectionReceipt
    const projection = row.projection
    const sameIds = Array.isArray(row.itemIds) && row.itemIds.length === expected.itemIds.length
        && new Set(row.itemIds).size === row.itemIds.length && row.itemIds.every(id => expected.itemIds.includes(id))
    const allowedWatchlistIds = new Set(expected.itemIds.map(id => `org_shared_watchlist:${expected.organizationId}:${id}`))
    return row.schemaVersion === WATCHLIST_PROJECTION_RECEIPT && row.organizationId === expected.organizationId && sameIds
        && Boolean(projection) && ['synchronized', 'unchanged'].includes(projection.status)
        && projection.source === 'identity' && typeof projection.checkedAt === 'string' && Number.isFinite(Date.parse(projection.checkedAt))
        && Array.isArray(projection.watchlistIds) && projection.watchlistIds.every(id => allowedWatchlistIds.has(id))
        && Array.isArray(projection.unresolvedItemIds) && projection.unresolvedItemIds.length === 0
        && row.alertRebuild?.status === 'not_requested' && row.alertRebuild.reason === 'projection_only'
}
