import type { PublicTiHandoffArtifact, PublicTiHandoffDecodeResult, PublicTiHandoffPayload } from './actorWorkbenchTypes'
import type { TiHandoffExportPayload } from './actionability'
import { PUBLIC_TI_HANDOFF_SCHEMA_VERSION, PUBLIC_TI_HANDOFF_SOURCE } from './actorWorkbenchTypes'
import { actionReadinessFor, blockersForBridge, evidenceRefsFor, sourceRequestsFor } from './publicTiHandoffEvidence'
import { unique } from './actorArtifactUtils'
import { failure, isRecord, normalizeHandoffAction, readPayloadQuery, readStringArray, selectedPayloadForAction } from './publicTiHandoffValues'

export function validatePublicTiHandoffPayload(value: unknown, intent?: string | null): PublicTiHandoffDecodeResult {
    const normalized = normalizePublicTiHandoffPayload(value, intent)
    if (!normalized.ok) return normalized
    return { ok: true, payload: normalized.payload, action: normalized.payload.action, reasonCodes: [] }
}

function normalizePublicTiHandoffPayload(value: unknown, intent?: string | null): PublicTiHandoffDecodeResult {
    if (!isRecord(value)) return failure('invalid_payload', 'The public TI handoff payload must be a JSON object.')
    if (!value.schemaVersion) return normalizeLegacyPublicTiHandoffPayload(value, intent)
    if (value.schemaVersion !== PUBLIC_TI_HANDOFF_SCHEMA_VERSION) return failure('unsupported_schema', `Unsupported public TI handoff schema: ${String(value.schemaVersion)}.`)
    const action = normalizeHandoffAction(typeof value.action === 'string' ? value.action : intent)
    if (!action) return failure(value.action || intent ? 'invalid_action' : 'missing_action', 'The public TI handoff action is missing or unsupported.')
    const query = typeof value.query === 'string' ? value.query.trim() : ''
    if (!query) return failure('missing_query', 'The public TI handoff payload is missing query.')
    if (!isRecord(value.artifact)) return failure('missing_artifact', 'The public TI handoff payload is missing selected record context.')
    if (!isRecord(value.selectedPayload) || !isRecord(value.actionPayloads)) return failure('invalid_payload', 'The public TI handoff payload is missing selectedPayload or actionPayloads.')
    const recordId = typeof value.recordId === 'string' && value.recordId.trim()
        ? value.recordId
        : typeof value.artifact.id === 'string' ? value.artifact.id : ''
    if (!recordId) return failure('missing_artifact', 'The public TI handoff payload is missing recordId.')
    const normalized: PublicTiHandoffPayload = {
        schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
        source: PUBLIC_TI_HANDOFF_SOURCE,
        action,
        recordId,
        query,
        generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : '',
        artifact: value.artifact as PublicTiHandoffArtifact,
        selectedPayload: value.selectedPayload as TiHandoffExportPayload,
        actionPayloads: value.actionPayloads as PublicTiHandoffPayload['actionPayloads'],
        orgRequired: Boolean(value.orgRequired),
        sourceRequired: Boolean(value.sourceRequired),
        stale: Boolean(value.stale),
        missing: Array.isArray(value.missing) ? value.missing.filter((item): item is string => typeof item === 'string') : [],
        blockers: Array.isArray(value.blockers) ? value.blockers as PublicTiHandoffPayload['blockers'] : [],
        actionReadiness: Array.isArray(value.actionReadiness) ? value.actionReadiness as PublicTiHandoffPayload['actionReadiness'] : [],
        evidenceRefs: isRecord(value.evidenceRefs) ? value.evidenceRefs as PublicTiHandoffPayload['evidenceRefs'] : undefined,
        sourceRequests: Array.isArray(value.sourceRequests) ? value.sourceRequests as PublicTiHandoffPayload['sourceRequests'] : [],
    }
    if (!normalized.actionReadiness.length) {
        normalized.actionReadiness = actionReadinessFor(action, normalized.actionPayloads, normalized.artifact, normalized, normalized.sourceRequests)
    }
    if (!normalized.evidenceRefs) {
        normalized.evidenceRefs = evidenceRefsFor(normalized.artifact, normalized.actionPayloads, normalized.sourceRequests)
    }
    return { ok: true, payload: normalized, action, reasonCodes: [] }
}

function normalizeLegacyPublicTiHandoffPayload(value: Record<string, unknown>, intent?: string | null): PublicTiHandoffDecodeResult {
    const action = normalizeHandoffAction(intent)
    if (!action) return failure(intent ? 'invalid_action' : 'missing_action', 'Legacy public TI handoff payloads require a supported intent.')
    if (!isRecord(value.artifact)) return failure('missing_artifact', 'Legacy public TI handoff payload is missing artifact.')
    const actionPayloads = {
        watchlist: value.watchlist,
        alertRebuild: value.alertRebuild,
        case: value.case,
        enrichment: value.enrichment,
    }
    if (!isRecord(actionPayloads.watchlist) || !isRecord(actionPayloads.alertRebuild) || !isRecord(actionPayloads.case) || !isRecord(actionPayloads.enrichment)) {
        return failure('invalid_payload', 'Legacy public TI handoff payload is missing one or more action payloads.')
    }
    const selectedPayload = selectedPayloadForAction(action, actionPayloads as PublicTiHandoffPayload['actionPayloads'])
    const artifact = value.artifact as PublicTiHandoffArtifact
    const missing = unique([
        ...readStringArray(actionPayloads.watchlist.missing),
        ...readStringArray(actionPayloads.alertRebuild.missing),
        ...readStringArray(actionPayloads.case.missing),
        ...readStringArray(actionPayloads.enrichment.missing),
        ...readStringArray(isRecord(artifact.readiness) ? artifact.readiness.blockers : undefined),
    ])
    const query = readPayloadQuery(actionPayloads as PublicTiHandoffPayload['actionPayloads'])
    if (!query) return failure('missing_query', 'Legacy public TI handoff payload is missing query.')
    const bridgeState = {
        orgRequired: missing.some(item => /organization|org|member|admin/i.test(item)),
        sourceRequired: missing.some(item => /source|provenance|capture|url/i.test(item)),
        stale: isRecord(artifact.readiness) && artifact.readiness.state === 'stale',
        missing,
    }
    const sourceRequests = sourceRequestsFor(actionPayloads as PublicTiHandoffPayload['actionPayloads'])
    const payload: PublicTiHandoffPayload = {
        schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
        source: PUBLIC_TI_HANDOFF_SOURCE,
        action,
        recordId: artifact.id,
        query,
        generatedAt: typeof selectedPayload.generatedAt === 'string' ? selectedPayload.generatedAt : '',
        artifact,
        selectedPayload,
        actionPayloads: actionPayloads as PublicTiHandoffPayload['actionPayloads'],
        ...bridgeState,
        blockers: blockersForBridge(artifact, bridgeState),
        actionReadiness: actionReadinessFor(action, actionPayloads as PublicTiHandoffPayload['actionPayloads'], artifact, bridgeState, sourceRequests),
        evidenceRefs: evidenceRefsFor(artifact, actionPayloads as PublicTiHandoffPayload['actionPayloads'], sourceRequests),
        sourceRequests,
    }
    return { ok: true, payload, action, reasonCodes: [] }
}
