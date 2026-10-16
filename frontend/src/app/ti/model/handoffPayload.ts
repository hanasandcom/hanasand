import { encodeHandoffPayload, type PublicTiHandoffPayload } from '@/utils/ti/actorWorkbench'

export function authenticatedPublicTiHref(route: string | undefined, params: Record<string, string | undefined>, payload?: PublicTiHandoffPayload) {
    const normalizedRoute = normalizedAuthenticatedRoute(route)
    const [path, existingQuery = ''] = normalizedRoute.split('?')
    const search = new URLSearchParams(existingQuery)
    search.set('handoff', 'public-ti')
    if (payload) {
        const urlPayload = compactPublicTiHandoffPayload(payload)
        search.set('intent', payload.action)
        search.set('payload', decodeURIComponent(encodeHandoffPayload(urlPayload)))
    }
    Object.entries(params).forEach(([key, value]) => {
        if (value) search.set(key, value)
    })
    return `${path}?${search.toString()}`
}

export function compactPublicTiHandoffPayload(payload: PublicTiHandoffPayload): PublicTiHandoffPayload {
    return {
        ...payload,
        missing: payload.missing.slice(0, 4).map(value => compactHandoffText(value, 100)),
        artifact: {
            ...payload.artifact,
            evidence: payload.artifact.evidence.slice(0, 1).map(item => compactHandoffText(item, 140)),
            provenance: payload.artifact.provenance.slice(0, 1).map(item => compactHandoffText(item, 120)),
            watchlistTerms: payload.artifact.watchlistTerms.slice(0, 2).map(term => ({
                ...term,
                value: compactHandoffText(term.value, 100),
                notes: compactHandoffText(term.notes, 90),
            })),
            enrichmentTasks: payload.artifact.enrichmentTasks.slice(0, 1).map(item => compactHandoffText(item, 120)),
        },
        selectedPayload: compactHandoffExportPayload(payload.selectedPayload),
        actionPayloads: {
            watchlist: compactHandoffExportPayload(payload.actionPayloads.watchlist),
            alertRebuild: compactHandoffExportPayload(payload.actionPayloads.alertRebuild),
            case: compactHandoffExportPayload(payload.actionPayloads.case),
            enrichment: compactHandoffExportPayload(payload.actionPayloads.enrichment),
        },
        blockers: payload.blockers.slice(0, 4).map(blocker => ({
            ...blocker,
            detail: compactHandoffText(blocker.detail, 140),
        })),
        actionReadiness: payload.actionReadiness.map(item => ({
            action: item.action,
            route: item.route,
            backedRoute: item.backedRoute,
            ready: item.ready,
            selected: item.selected,
            ownerLane: item.ownerLane,
            sourceRequestCount: item.sourceRequestCount,
            missing: item.missing.slice(0, 2).map(value => compactHandoffText(value, 90)),
            blockerCodes: item.blockerCodes.slice(0, 4),
        })),
        evidenceRefs: payload.evidenceRefs ? {
            sourceNames: payload.evidenceRefs.sourceNames.slice(0, 2).map(value => compactHandoffText(value, 80)),
            provenanceRefs: payload.evidenceRefs.provenanceRefs.slice(0, 1).map(value => compactHandoffText(value, 100)),
            captureIds: payload.evidenceRefs.captureIds.slice(0, 2),
            alertIds: payload.evidenceRefs.alertIds.slice(0, 2),
            casePaths: payload.evidenceRefs.casePaths.slice(0, 2),
            watchlistTerms: payload.evidenceRefs.watchlistTerms.slice(0, 2).map(value => compactHandoffText(value, 80)),
            endpoints: payload.evidenceRefs.endpoints.slice(0, 2).map(value => compactHandoffText(value, 100)),
        } : undefined,
        sourceRequests: [],
    }
}

export function compactHandoffExportPayload(payload: PublicTiHandoffPayload['selectedPayload']): PublicTiHandoffPayload['selectedPayload'] {
    return {
        schemaVersion: payload.schemaVersion,
        query: payload.query,
        generatedAt: payload.generatedAt,
        route: payload.route,
        method: payload.method,
        endpoint: payload.endpoint,
        backedRoute: payload.backedRoute,
        blocked: payload.blocked,
        missing: payload.missing.slice(0, 4).map(value => compactHandoffText(value, 120)),
        provenance: [],
        body: compactHandoffBody(payload.body),
    }
}

export function compactHandoffBody(body: Record<string, unknown>): Record<string, unknown> {
    const compact: Record<string, unknown> = {}
    const passthroughKeys = ['sourceType', 'sourceId', 'title', 'priority', 'artifactId', 'query', 'caseId', 'alertId']
    passthroughKeys.forEach(key => {
        const value = body[key]
        if (typeof value === 'string') compact[key] = compactHandoffText(value, 140)
        else if (typeof value === 'number' || typeof value === 'boolean') compact[key] = value
    })
    if (typeof body.summary === 'string') compact.summary = compactHandoffText(body.summary, 120)
    if (isPlainRecord(body.actorContext)) {
        compact.actorContext = {
            query: typeof body.actorContext.query === 'string' ? compactHandoffText(body.actorContext.query, 80) : body.actorContext.query,
            actorClass: typeof body.actorContext.actorClass === 'string' ? compactHandoffText(body.actorContext.actorClass, 80) : body.actorContext.actorClass,
            confidence: body.actorContext.confidence,
        }
    }
    if (isPlainRecord(body.selectedArtifact)) {
        compact.selectedArtifact = {
            artifactId: body.selectedArtifact.artifactId,
            kind: body.selectedArtifact.kind,
            label: typeof body.selectedArtifact.label === 'string' ? compactHandoffText(body.selectedArtifact.label, 120) : body.selectedArtifact.label,
            confidence: body.selectedArtifact.confidence,
            freshness: body.selectedArtifact.freshness,
        }
    }
    const termKeys = ['terms', 'watchTerms']
    termKeys.forEach(key => {
        const value = body[key]
        if (Array.isArray(value)) compact[key] = value.slice(0, 2).map(compactWatchTerm)
    })
    const idKeys = ['relatedAlertIds', 'relatedCaseIds']
    idKeys.forEach(key => {
        const value = body[key]
        if (Array.isArray(value)) compact[key] = value.slice(0, 2).map(item => compactHandoffText(String(item), 100))
    })
    return Object.keys(compact).length ? compact : body
}

export function compactWatchTerm(item: unknown) {
    if (!isPlainRecord(item)) return item
    return {
        kind: item.kind,
        value: typeof item.value === 'string' ? compactHandoffText(item.value, 100) : item.value,
        notes: typeof item.notes === 'string' ? compactHandoffText(item.notes, 80) : undefined,
        reason: typeof item.reason === 'string' ? compactHandoffText(item.reason, 80) : undefined,
    }
}

export function compactHandoffText(value: string, maxLength: number) {
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizedAuthenticatedRoute(route: string | undefined) {
    if (!route) return '/findings'
    if (route.startsWith('/v1/cases')) return '/dashboard'
    if (route.startsWith('/v1/dwm')) return '/findings'
    if (route.startsWith('/findings') || route.startsWith('/ti/') || route === '/dashboard') return route
    return '/findings'
}
