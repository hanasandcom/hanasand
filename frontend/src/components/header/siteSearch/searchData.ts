import { actorSummary, usefulActorSummary } from '@/utils/ti/actorSummary'
import type { SearchItem } from './types'

export function filterItems(items: SearchItem[], query: string) {
    if (!query) return items
    return items.filter(item => `${item.title} ${item.detail} ${item.href}`.toLowerCase().includes(query))
}

export function routeRelevance(item: SearchItem, query: string) {
    if (!query) return 0
    const title = item.title.toLowerCase()
    if (title === query) return 3
    if (title.startsWith(query)) return 2
    return 1
}

export function directThreatItem(query: string, actorResults: SearchItem[] = []): SearchItem | null {
    const value = query.trim()
    if (value.length < 2) return null
    const href = `/ti/${encodeURIComponent(value)}`
    const matchedActor = actorResults.find(item => item.href.toLowerCase() === href.toLowerCase())
    if (!matchedActor) return null
    return {
        ...matchedActor,
        detail: matchedActor.detail.startsWith('Threat actor profile')
            ? matchedActor.detail
            : `Threat actor profile · ${matchedActor.detail}`,
    }
}

export function manualSearchItem(query: string): SearchItem {
    return {
        id: `search:${query}`,
        title: `Search “${query}”`,
        detail: 'Full-text retained evidence search',
        href: `/ti/${encodeURIComponent(query)}`,
    }
}

export async function loadCases(signal: AbortSignal): Promise<SearchItem[]> {
    const response = await fetch('/api/cases', { cache: 'no-store', signal })
    if (!response.ok) throw new Error('Cases are temporarily unavailable.')
    const payload = await response.json()
    return arrayFrom(payload, ['cases', 'items', 'rows'])
        .map(caseItem)
        .filter(isSearchItem)
}

export async function loadActors(query: string, signal: AbortSignal): Promise<SearchItem[]> {
    if (!query) return []
    const params = new URLSearchParams({ q: query, limit: '8', entityType: exactEntityType(query), cached: 'true' })
    const response = await fetch(`/api/ti/search?${params.toString()}`, { cache: 'no-store', signal })
    if (!response.ok) return []
    const payload = await response.json()
    const preview = actorPreviewItem(payload, query)
    return uniqueByHref([...(preview ? [preview] : []), ...actorItems(payload), ...evidenceItems(payload)]).slice(0, 8)
}

export function caseItem(value: unknown): SearchItem | null {
    if (!value || typeof value !== 'object') return null
    const row = value as Record<string, unknown>
    const id = stringValue(row.id) || stringValue(row.caseId)
    if (!id) return null
    const title = stringValue(row.title) || stringValue(row.company) || stringValue(row.organizationName) || id
    const detail = [stringValue(row.status), stringValue(row.organizationName), stringValue(row.summary)].filter(Boolean).join(' · ')
    const href = stringValue(row.casePath) || `/cases/${encodeURIComponent(id)}`
    return { id: `case:${id}`, title, detail, href }
}

export function actorItems(payload: unknown): SearchItem[] {
    const rows = arrayFrom(payload, ['actors', 'actorOverviews'])
    const fromRows = rows.map(actorItem).filter(isSearchItem)
    if (fromRows.length) return uniqueByHref(fromRows)
    if (!payload || typeof payload !== 'object' || stringValue((payload as Record<string, unknown>).status).toLowerCase() !== 'ready') return []
    const fallbackTitle = stringValue((payload as Record<string, unknown>).actor)
    if (!fallbackTitle) return []
    return [{ id: `actor:${fallbackTitle}`, title: fallbackTitle, detail: 'Threat actor profile', href: `/ti/${encodeURIComponent(fallbackTitle)}` }]
}

export function watchlistTerms(value: unknown): SearchItem[] {
    if (!value || typeof value !== 'object') return []
    const row = value as Record<string, unknown>
    const terms = Array.isArray(row.terms) ? row.terms : Array.isArray(row.items) ? row.items : []
    return terms.flatMap(term => {
        const item = term && typeof term === 'object' ? term as Record<string, unknown> : null
        const value = typeof term === 'string' ? term : stringValue(item?.value || item?.term)
        return value ? [{ id: `watch:${value}`, title: value, detail: 'Monitored entity', href: '/watchlists' }] : []
    })
}

export function watchlistItems(payload: unknown): SearchItem[] {
    return arrayFrom(payload, ['watchlists', 'items', 'rows']).flatMap(watchlistTerms).slice(0, 20)
}

export function authorizedWatchlistItems(token: boolean, items: SearchItem[]): SearchItem[] {
    return token ? items : []
}

function actorPreviewItem(payload: unknown, query: string): SearchItem | null {
    if (!payload || typeof payload !== 'object') return null
    const row = payload as Record<string, unknown>
    const intelligence = isRecord(row.actorIntelligence) ? row.actorIntelligence : null
    const identity = isRecord(row.actorIdentity) ? row.actorIdentity : null
    const candidates = arrayFrom(identity, ['candidates'])
    const candidate = candidates.length === 1 && isRecord(candidates[0]) ? candidates[0] : null
    if (row.queryKind !== 'actor' && !intelligence) return null
    const title = actorDisplayName(stringValue(row.query) || query)
    const detail = usefulActorSummary(stringValue(candidate?.description))
        || usefulActorSummary(stringValue(row.summary))
        || actorSummary({
            name: title,
            aliases: stringArray(candidate?.associatedNames),
            actorClass: stringValue(intelligence?.actorClass),
            attribution: stringValue(intelligence?.attribution),
            targetSectors: stringArray(intelligence?.targetSectors),
            geographies: stringArray(intelligence?.geographies),
            malwareTools: stringArray(intelligence?.malwareTools),
        })
        || `${title} threat actor profile`
    const actorQuery = stringValue(row.query) || query
    return {
        id: `actor-preview:${title}`,
        title,
        detail: `Threat actor profile · ${detail}`,
        href: `/ti/${encodeURIComponent(actorQuery)}`,
    }
}

function actorDisplayName(value: string) {
    return /^apt\d+$/i.test(value) ? value.toUpperCase() : value
}

function exactEntityType(query: string) {
    return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(query) ? 'domain' : 'actor'
}

function evidenceItems(payload: unknown): SearchItem[] {
    return arrayFrom(payload, ['results', 'rows']).map(value => {
        if (!isRecord(value)) return null
        const id = stringValue(value.id) || stringValue(value.captureId)
        const title = stringValue(value.title) || stringValue(value.sourceName) || stringValue(value.url)
        if (!id || !title) return null
        const detail = stringValue(value.summary) || stringValue(value.excerpt) || stringValue(value.body)
        const query = stringValue(value.query) || title
        return {
            id: `evidence:${id}`,
            title,
            detail: `Recent evidence${detail ? ` · ${detail}` : ''}`,
            href: `/ti/${encodeURIComponent(query)}`,
        }
    }).filter(isSearchItem)
}

function actorItem(value: unknown): SearchItem | null {
    if (!isRecord(value)) return null
    const title = stringValue(value.actor) || stringValue(value.name) || stringValue(value.title) || stringValue(value.query)
    if (!title) return null
    const detail = [stringValue(value.confidence), stringValue(value.latestSeenAt), stringValue(value.summary)].filter(Boolean).join(' · ')
    return {
        id: `actor:${title}`,
        title,
        detail: `Threat actor profile${detail ? ` · ${detail}` : ''}`,
        href: `/ti/${encodeURIComponent(title)}`,
    }
}

function arrayFrom(payload: unknown, keys: string[]): unknown[] {
    if (Array.isArray(payload)) return payload
    if (!isRecord(payload)) return []
    for (const key of keys) {
        if (Array.isArray(payload[key])) return payload[key]
    }
    return []
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function stringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function uniqueByHref(items: SearchItem[]) {
    const seen = new Set<string>()
    return items.filter(item => {
        if (seen.has(item.href)) return false
        seen.add(item.href)
        return true
    })
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object')
}

function isSearchItem(value: SearchItem | null): value is SearchItem {
    return Boolean(value)
}
