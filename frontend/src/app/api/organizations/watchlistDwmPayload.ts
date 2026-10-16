import { arrayOfRecords, type JsonRecord } from './watchlistDwmValues'

export type DwmWatchlistMirrorPayload = {
    id: string
    tenantId: string
    organizationId: string
    name: string
    status: 'active' | 'paused' | 'archived'
    terms: Array<{ id?: string, value: string, kind?: string }>
    reason: string
}

export function buildDwmWatchlistMirrorPayload(input: { organizationId: string, watchlistItem: JsonRecord | undefined }): DwmWatchlistMirrorPayload | null {
    const item = input.watchlistItem
    const value = String(item?.value ?? item?.term ?? '').trim()
    const itemId = String(item?.id ?? item?.watchlistItemId ?? '').trim()
    if (!input.organizationId || !value || !itemId) return null

    const rawStatus = String(item?.status ?? 'active').toLowerCase()
    const status = rawStatus === 'paused' || rawStatus === 'archived' ? rawStatus : 'active'
    const kind = normalizeDwmTermKind(item?.kind ?? item?.termFamily ?? item?.category)
    return {
        id: `org_${itemId}`,
        tenantId: input.organizationId,
        organizationId: input.organizationId,
        name: `Org watchlist - ${value}`,
        status,
        terms: [{ id: itemId, value, kind }],
        reason: status === 'active' ? 'organization_watchlist_saved' : 'organization_watchlist_lifecycle_updated',
    }
}

export function buildDwmWatchlistMirrorPayloads(input: { organizationId: string, organizationPayload: JsonRecord }): DwmWatchlistMirrorPayload[] {
    const items = [input.organizationPayload.watchlistItem, ...arrayOfRecords(input.organizationPayload.archivedItems)].filter(Boolean) as JsonRecord[]
    const payloads = items
        .map(watchlistItem => buildDwmWatchlistMirrorPayload({ organizationId: input.organizationId, watchlistItem }))
        .filter((payload): payload is DwmWatchlistMirrorPayload => Boolean(payload))
    return Array.from(new Map(payloads.map(payload => [payload.id, payload])).values())
}

function normalizeDwmTermKind(value: unknown) {
    const kind = String(value ?? '').toLowerCase()
    if (['company', 'domain', 'vendor', 'brand', 'vip', 'product'].includes(kind)) return kind
    return 'unknown'
}
