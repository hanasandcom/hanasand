import { PUBLIC_TI_HANDOFF_ROUTES, PUBLIC_TI_HANDOFF_ACTIONS } from './actorWorkbenchTypes'
import type { AuthenticatedArtifactBridge, PublicTiHandoffAction, PublicTiHandoffActionBlockerCode, PublicTiHandoffArtifact, PublicTiHandoffPayload } from './actorWorkbenchTypes'
import { isRecord } from './publicTiHandoffValues'
import { formatDate, unique, uniqueBy } from './actorArtifactUtils'

export function blockersForBridge(artifact: PublicTiHandoffArtifact, bridgeState: Pick<AuthenticatedArtifactBridge, 'orgRequired' | 'sourceRequired' | 'stale' | 'missing'>): PublicTiHandoffPayload['blockers'] {
    return [
        ...(bridgeState.orgRequired ? [{ code: 'org_required' as const, detail: 'Open this payload in an authenticated organization context before creating watchlists, rebuilding alerts, or creating cases.' }] : []),
        ...(bridgeState.sourceRequired ? [{ code: 'source_required' as const, detail: 'Attach source details, capture ID, source URL, or request ID before using this artifact as alert or case evidence.' }] : []),
        ...(bridgeState.stale ? [{ code: 'stale_evidence' as const, detail: `Fresh source is required after ${formatDate(artifact.freshness)} before sending this to review.` }] : []),
        ...(!artifact.watchlistTerms.length && artifact.kind !== 'technique' ? [{ code: 'missing_watchlist_term' as const, detail: 'Add or select an organization watchlist term before alert rebuild.' }] : []),
    ]
}

export function actionReadinessFor(
    selectedAction: PublicTiHandoffAction,
    payloads: PublicTiHandoffPayload['actionPayloads'],
    artifact: PublicTiHandoffArtifact,
    bridgeState: Pick<AuthenticatedArtifactBridge, 'orgRequired' | 'sourceRequired' | 'stale' | 'missing'>,
    sourceRequests: PublicTiHandoffPayload['sourceRequests']
): PublicTiHandoffPayload['actionReadiness'] {
    const entries = [
        { action: PUBLIC_TI_HANDOFF_ACTIONS.watchlist, payload: payloads.watchlist, ownerLane: 'org' as const },
        { action: PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild, payload: payloads.alertRebuild, ownerLane: 'alert' as const },
        { action: PUBLIC_TI_HANDOFF_ACTIONS.case, payload: payloads.case, ownerLane: 'case' as const },
        { action: PUBLIC_TI_HANDOFF_ACTIONS.enrichment, payload: payloads.enrichment, ownerLane: 'source' as const },
    ]
    return entries.map(entry => {
        const missing = unique([
            ...entry.payload.missing,
            ...(entry.action === PUBLIC_TI_HANDOFF_ACTIONS.enrichment ? [] : artifact.readiness.blockers),
        ])
        const blockerCodes = uniqueBlockerCodes([
            ...(bridgeState.orgRequired && (entry.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist || entry.action === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild || entry.action === PUBLIC_TI_HANDOFF_ACTIONS.case) ? ['org_required' as const] : []),
            ...(bridgeState.sourceRequired ? ['source_required' as const] : []),
            ...(bridgeState.stale ? ['stale_evidence' as const] : []),
            ...(!artifact.watchlistTerms.length && (entry.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist || entry.action === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild) ? ['missing_watchlist_term' as const] : []),
            ...(entry.payload.blocked ? ['action_blocked' as const] : []),
        ])
        return {
            action: entry.action,
            route: entry.payload.route,
            endpoint: entry.payload.endpoint,
            backedRoute: entry.payload.backedRoute,
            ready: !entry.payload.blocked && missing.length === 0 && !blockerCodes.length,
            missing,
            blockerCodes,
            ownerLane: entry.ownerLane,
            selected: entry.action === selectedAction,
            sourceRequestCount: sourceRequests.length,
        }
    })
}

function uniqueBlockerCodes(values: PublicTiHandoffActionBlockerCode[]) {
    return Array.from(new Set(values))
}

export function evidenceRefsFor(artifact: PublicTiHandoffArtifact, payloads: PublicTiHandoffPayload['actionPayloads'], sourceRequests: PublicTiHandoffPayload['sourceRequests']): NonNullable<PublicTiHandoffPayload['evidenceRefs']> {
    const payloadList = [payloads.watchlist, payloads.alertRebuild, payloads.case, payloads.enrichment]
    return {
        sourceNames: unique([
            ...artifact.provenance,
            ...payloadList.flatMap(payload => payload.provenance.map(source => source.sourceName)),
            ...sourceRequests.map(request => request.sourceName),
        ]).slice(0, 20),
        provenanceRefs: unique([
            ...artifact.provenance,
            ...payloadList.flatMap(payload => payload.provenance.map(source => source.provenance)),
            ...sourceRequests.map(request => request.provenance),
        ]).slice(0, 20),
        captureIds: unique([
            ...payloadList.flatMap(payload => payload.provenance.map(source => source.captureId).filter((value): value is string => Boolean(value))),
            ...sourceRequests.map(request => request.captureId).filter((value): value is string => Boolean(value)),
            ...payloadList.flatMap(payload => collectStringFields(payload.body, ['captureId', 'captureIds'])),
        ]).slice(0, 20),
        alertIds: unique(payloadList.flatMap(payload => collectStringFields(payload.body, ['alertId', 'alertIds']))).slice(0, 20),
        casePaths: unique(payloadList.flatMap(payload => collectStringFields(payload.body, ['casePath', 'casePaths']))).slice(0, 20),
        watchlistTerms: unique([
            ...artifact.watchlistTerms.map(term => `${term.kind}:${term.value}`),
            ...payloadList.flatMap(payload => collectWatchlistTerms(payload.body)),
        ]).slice(0, 20),
        endpoints: unique(payloadList.flatMap(payload => [payload.endpoint, payload.backedRoute].filter((value): value is string => Boolean(value)))).slice(0, 20),
    }
}

function collectStringFields(value: unknown, keys: string[]): string[] {
    if (Array.isArray(value)) return value.flatMap(item => collectStringFields(item, keys))
    if (!isRecord(value)) return []
    return Object.entries(value).flatMap(([key, entry]) => {
        const nested = collectStringFields(entry, keys)
        if (!keys.includes(key)) return nested
        if (typeof entry === 'string' && entry.trim()) return [entry.trim(), ...nested]
        if (Array.isArray(entry)) return [...entry.filter((item): item is string => typeof item === 'string' && item.trim().length > 0), ...nested]
        return nested
    })
}

function collectWatchlistTerms(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(collectWatchlistTerms)
    if (!isRecord(value)) return []
    const termValue = typeof value.value === 'string' ? value.value.trim() : ''
    const termKind = typeof value.kind === 'string' ? value.kind.trim() : ''
    return [
        ...(termValue && (termKind === 'company' || termKind === 'domain' || termKind === 'vendor') ? [`${termKind}:${termValue}`] : []),
        ...Object.values(value).flatMap(collectWatchlistTerms),
    ]
}

export function sourceRequestsFor(payloads: PublicTiHandoffPayload['actionPayloads']): PublicTiHandoffPayload['sourceRequests'] {
    return uniqueBy(Object.values(payloads).flatMap(payload => payload.provenance).map(source => ({
        sourceName: source.sourceName,
        provenance: source.provenance,
        captureId: source.captureId,
        confidence: source.confidence,
        missing: source.captureId ? [] : ['captureId or source request ID'],
        ownerLane: 'source' as const,
        route: PUBLIC_TI_HANDOFF_ROUTES.enrichment,
        sourceFamily: 'source_capture' as const,
        requestedFields: source.captureId
            ? ['sourceProvenance[].sourceName', 'sourceProvenance[].provenance', 'sourceProvenance[].captureId']
            : ['sourceProvenance[].sourceName', 'sourceProvenance[].provenance', 'sourceProvenance[].captureId', 'sourceProvenance[].sourceRequestId'],
    })), source => `${source.sourceName}:${source.provenance}:${source.captureId ?? ''}`)
}
