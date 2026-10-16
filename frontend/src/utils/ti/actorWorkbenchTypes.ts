import type { TiHandoffExportPayload } from './actionability'

export const PUBLIC_TI_HANDOFF_SCHEMA_VERSION = 'ti.public_actor.authenticated_bridge.v1' as const
export const PUBLIC_TI_HANDOFF_SOURCE = 'public-ti' as const
export const PUBLIC_TI_HANDOFF_QUERY_PARAM = 'payload' as const
export const PUBLIC_TI_HANDOFF_INTENT_PARAM = 'intent' as const

export const PUBLIC_TI_HANDOFF_ACTIONS = {
    watchlist: 'create_watchlist',
    alertRebuild: 'rebuild_alerts',
    case: 'open_case',
    enrichment: 'queue_enrichment',
} as const

export const PUBLIC_TI_HANDOFF_ROUTES = {
    watchlist: '/findings',
    alertRebuild: '/findings',
    case: '/ti/workbench',
    enrichment: '/ti/profiles',
} as const

export type ActorArtifactKind = 'country' | 'tool' | 'campaign' | 'infrastructure' | 'technique'
export type PublicTiHandoffAction = typeof PUBLIC_TI_HANDOFF_ACTIONS[keyof typeof PUBLIC_TI_HANDOFF_ACTIONS]
export type PublicTiHandoffActionBlockerCode = 'org_required' | 'source_required' | 'stale_evidence' | 'missing_watchlist_term' | 'action_blocked'
export type PublicTiHandoffDecodeFailureCode =
    | 'missing_payload'
    | 'malformed_json'
    | 'unsupported_schema'
    | 'missing_action'
    | 'invalid_action'
    | 'missing_query'
    | 'missing_artifact'
    | 'invalid_payload'

export type PublicTiHandoffDecodeResult =
    | { ok: true; payload: PublicTiHandoffPayload; action: PublicTiHandoffAction; reasonCodes: [] }
    | { ok: false; code: PublicTiHandoffDecodeFailureCode; message: string; reasonCodes: PublicTiHandoffDecodeFailureCode[] }

export type ActorArtifactReadiness = {
    state: 'ready_for_org_handoff' | 'context_only' | 'needs_source' | 'stale' | 'needs_watchlist_term'
    label: string
    blockers: string[]
}

export type ActorArtifact = {
    id: string
    kind: ActorArtifactKind
    label: string
    subtitle: string
    confidence: number
    freshness: string
    evidence: string[]
    provenance: string[]
    watchlistTerms: Array<{ kind: 'company' | 'domain' | 'vendor'; value: string; notes: string }>
    enrichmentTasks: string[]
    readiness: ActorArtifactReadiness
}

export type PublicTiHandoffArtifact = Pick<ActorArtifact, 'id' | 'kind' | 'label' | 'confidence' | 'freshness' | 'evidence' | 'provenance' | 'watchlistTerms' | 'enrichmentTasks' | 'readiness'>

export type PublicTiHandoffPayload = {
    schemaVersion: typeof PUBLIC_TI_HANDOFF_SCHEMA_VERSION
    source: typeof PUBLIC_TI_HANDOFF_SOURCE
    action: PublicTiHandoffAction
    recordId: string
    query: string
    generatedAt: string
    artifact: PublicTiHandoffArtifact
    selectedPayload: TiHandoffExportPayload
    actionPayloads: {
        watchlist: TiHandoffExportPayload
        alertRebuild: TiHandoffExportPayload
        case: TiHandoffExportPayload
        enrichment: TiHandoffExportPayload
    }
    orgRequired: boolean
    sourceRequired: boolean
    stale: boolean
    missing: string[]
    blockers: Array<{ code: 'org_required' | 'source_required' | 'stale_evidence' | 'missing_watchlist_term'; detail: string }>
    actionReadiness: Array<{
        action: PublicTiHandoffAction
        route: TiHandoffExportPayload['route']
        endpoint?: string
        backedRoute?: string
        ready: boolean
        missing: string[]
        blockerCodes: PublicTiHandoffActionBlockerCode[]
        ownerLane: 'org' | 'alert' | 'case' | 'source'
        selected: boolean
        sourceRequestCount: number
    }>
    evidenceRefs?: {
        sourceNames: string[]
        provenanceRefs: string[]
        captureIds: string[]
        alertIds: string[]
        casePaths: string[]
        watchlistTerms: string[]
        endpoints: string[]
    }
    sourceRequests: Array<{
        sourceName: string
        provenance: string
        captureId?: string
        confidence?: number
        missing: string[]
        ownerLane?: 'source'
        route?: '/ti/profiles'
        sourceFamily?: 'source_capture'
        requestedFields?: string[]
    }>
}

export type AuthenticatedArtifactBridge = {
    schemaVersion: typeof PUBLIC_TI_HANDOFF_SCHEMA_VERSION
    recordId: string
    query: string
    orgRequired: boolean
    sourceRequired: boolean
    stale: boolean
    missing: string[]
    links: Record<'watchlist' | 'alertRebuild' | 'case' | 'enrichment', { label: string; href: string; intent: PublicTiHandoffAction }>
    payload: PublicTiHandoffPayload
    payloads: Record<PublicTiHandoffAction, PublicTiHandoffPayload>
}

export type ActorArtifactHandoffs = {
    watchlist: TiHandoffExportPayload
    alertRebuild: TiHandoffExportPayload
    case: TiHandoffExportPayload
    enrichment: TiHandoffExportPayload
    authBridge: AuthenticatedArtifactBridge
}
