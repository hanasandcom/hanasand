import type { PublicTiHandoffDecodeResult } from '@/utils/ti/actorWorkbench'
import type { WorkbenchCase, WorkbenchEvidence, WorkbenchPublicTiHandoff, WorkbenchTimelineItem, WorkbenchWorkflowStep } from './ti/workbench/workbenchClient'

export function publicTiHandoffCase(input: {
    handoff: WorkbenchPublicTiHandoff
    title: string
    subtitle: string
    severity: WorkbenchCase['severity']
    status: string
    priority: number
    confidence: number
    updatedAt: string
    evidence: WorkbenchEvidence[]
    timeline?: WorkbenchTimelineItem[]
    workflowPath?: WorkbenchWorkflowStep[]
    nextTasks: string[]
    relatedLinks: WorkbenchCase['relatedLinks']
}): WorkbenchCase {
    const artifact = input.handoff.artifact
    return {
        id: `public_ti_${input.handoff.artifactId || input.status}`,
        kind: 'public_ti_handoff',
        queue: 'Actor evidence bridge',
        title: input.title,
        subtitle: input.subtitle,
        severity: input.severity,
        status: input.status,
        priority: input.priority,
        confidence: input.confidence,
        owner: input.handoff.decodeStatus === 'blocked' ? 'operator' : input.handoff.orgRequired ? 'operator' : 'analyst',
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt,
        company: input.handoff.query || artifact?.label || 'Public TI',
        matchedTerm: artifact?.watchlistTerms?.[0]?.value || artifact?.label || input.handoff.query || 'public-ti',
        actor: artifact?.kind || 'public TI artifact',
        sourceLabel: input.handoff.sourceRequests.length ? `${input.handoff.sourceRequests.length} source request(s)` : 'public TI bridge',
        recommendedAction: input.handoff.decodeStatus === 'blocked' ? 'Export a valid authenticated public TI bridge payload before mutating operator data.' : 'Review org/source checks, then add watchlist terms, rebuild alerts, open a case, or copy the exact handoff.',
        routeLabel: actionLabel(input.handoff.action),
        persistent: false,
        evidence: input.evidence,
        timeline: input.timeline || [],
        nextTasks: input.nextTasks,
        relatedLinks: input.relatedLinks,
        workflowPath: input.workflowPath,
        handoff: input.handoff,
        missingDependency: input.handoff.missing[0],
    }
}

export function publicTiEvidence(payload: Extract<PublicTiHandoffDecodeResult, { ok: true }>['payload'], now: string): WorkbenchEvidence[] {
    const artifactEvidence = (payload.artifact.evidence || []).slice(0, 4).map((excerpt, index) => ({
        id: `ev_public_ti_artifact_${index}`,
        sourceName: 'Public TI artifact',
        sourceFamily: payload.artifact.kind || 'actor record',
        captureMode: 'authenticated handoff',
        redactionState: 'customer safe',
        contentHash: `${payload.artifact.id}:${index}`,
        excerpt,
        observedAt: payload.artifact.freshness || payload.generatedAt || now,
        provenance: payload.artifact.provenance?.[index] || 'public TI selected record',
        confidence: payload.artifact.confidence,
    }))
    const sourceEvidence = payload.sourceRequests.slice(0, 4).map((source, index) => ({
        id: `ev_public_ti_source_${index}`,
        sourceName: source.sourceName,
        sourceFamily: 'source request',
        captureMode: source.captureId ? 'capture reference' : 'source request',
        redactionState: 'customer safe',
        contentHash: source.captureId || source.provenance,
        excerpt: source.missing.length ? `Missing: ${source.missing.join(', ')}` : source.provenance,
        observedAt: payload.generatedAt || now,
        provenance: source.provenance,
        confidence: source.confidence,
    }))
    return [...artifactEvidence, ...sourceEvidence].length ? [...artifactEvidence, ...sourceEvidence] : [{
        id: 'ev_public_ti_payload',
        sourceName: 'Actor evidence bridge',
        sourceFamily: 'authenticated bridge',
        captureMode: 'url payload',
        redactionState: 'customer safe',
        contentHash: payload.artifact.id,
        excerpt: `${payload.query} exported ${actionLabel(payload.action)}.`,
        observedAt: payload.generatedAt || now,
        provenance: 'decodePublicTiHandoffPayload',
        confidence: 70,
    }]
}

export function nextPublicTiTasks(input: { orgMissing: boolean, sourceBlocked: boolean, stale: boolean, watchTerms: number, selectedMissing: string[], action: string }) {
    if (input.orgMissing) return ['Owner: operator. Create or select an organization before mutation.', 'Copy exact public TI handoff if the organization state is not ready.', 'Return after org context loads and add watchlist or case from the handoff.']
    if (input.sourceBlocked || input.stale) return ['Owner: source-ops. Refresh source and capture evidence before alert generation.', 'Review source health in /ti/admin/sources.', 'Copy exact handoff if source records are still syncing.']
    if (!input.watchTerms) return ['Owner: analyst. Choose or add a watchlist term for this artifact.', 'Use enrichment before alert rebuild.', 'Copy exact handoff for source-ops if no customer term exists.']
    if (input.selectedMissing.length) return [`Owner: operator. Resolve: ${input.selectedMissing.join('; ')}.`, 'Then run the selected handoff action.', 'Keep the handoff payload attached as audit context.']
    return [`Owner: analyst. Run ${actionLabel(input.action)} from the action rail.`, 'Inspect generated alerts/case detail after refresh.', 'Test webhook before customer delivery.']
}

export function actionLabel(action: string | undefined) {
    if (action === 'create_watchlist') return 'create watchlist'
    if (action === 'rebuild_alerts') return 'rebuild alerts'
    if (action === 'open_case') return 'open case'
    if (action === 'queue_enrichment') return 'add context'
    return 'public TI handoff'
}
