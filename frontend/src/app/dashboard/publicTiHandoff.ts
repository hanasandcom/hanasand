import type { PublicTiHandoffDecodeResult } from '@/utils/ti/actorWorkbench'
import type { WorkbenchCase, WorkbenchEvidence, WorkbenchHandoffAction, WorkbenchPublicTiHandoff } from './ti/workbench/workbenchClient'
import type { DwmOperationsSnapshot, DwmOrganizationState, DwmWatchlistSummary, OperatorScope } from './operatorConsoleTypes'
import { publicTiHandoffCase, publicTiEvidence, nextPublicTiTasks, actionLabel } from './publicTiHandoffSupport'

export function buildPublicTiHandoffCase(input: {
    decode: PublicTiHandoffDecodeResult | null
    scope: OperatorScope
    organizationState: DwmOrganizationState
    watchlists: DwmWatchlistSummary[]
    operations: DwmOperationsSnapshot | null
    liveAlertCount: number
}): WorkbenchCase[] {
    if (!input.decode) return []
    const now = new Date().toISOString()
    if (!input.decode.ok) {
        return [publicTiHandoffCase({
            handoff: {
                decodeStatus: 'blocked',
                decodeError: input.decode.message,
                missing: input.decode.reasonCodes,
                blockers: [{ code: input.decode.code, detail: input.decode.message }],
                sourceRequests: [],
            },
            title: 'Actor evidence bridge blocked',
            subtitle: input.decode.message,
            severity: 'high',
            status: input.decode.code,
            priority: 520,
            confidence: 45,
            updatedAt: now,
            evidence: [{
                id: 'ev_public_ti_decode',
                sourceName: 'Actor evidence bridge decoder',
                sourceFamily: 'authenticated bridge',
                captureMode: 'url payload',
                redactionState: 'customer safe',
                contentHash: input.decode.code,
                excerpt: input.decode.message,
                observedAt: now,
                provenance: 'decodePublicTiHandoffPayload',
                confidence: 45,
            }],
            nextTasks: ['Copy the exact handoff payload or return to the public TI artifact and export a fresh authenticated bridge link.', 'Do not mutate org watchlists, cases, alerts, or enrichment until payload validation succeeds.'],
            relatedLinks: [{ href: '/ti', label: 'Public TI' }],
        })]
    }

    const payload = input.decode.payload
    const organization = input.organizationState.selectedOrganization
    const orgMissing = payload.orgRequired && !organization
    const sourceBlocked = payload.sourceRequired && !input.operations
    const watchTerms = payload.artifact.watchlistTerms || []
    const watchlistCovered = watchTerms.some(term => input.watchlists.some(watchlist => (watchlist.terms || []).some(candidate => candidate.value.toLowerCase() === term.value.toLowerCase())))
    const missing = [
        ...payload.missing,
        ...(orgMissing ? ['Selected organization context is syncing'] : []),
        ...(sourceBlocked ? ['DWM source state is syncing'] : []),
    ]
    const severity: WorkbenchCase['severity'] = orgMissing || sourceBlocked || payload.stale || missing.length ? 'high' : 'medium'
    const updatedAt = payload.generatedAt || now
    const selectedMissing = payload.selectedPayload.missing || []
    const handoff: WorkbenchPublicTiHandoff = {
        decodeStatus: 'ready',
        action: input.decode.action as WorkbenchHandoffAction,
        artifactId: payload.artifact.id,
        query: payload.query,
        generatedAt: payload.generatedAt,
        orgRequired: payload.orgRequired,
        sourceRequired: payload.sourceRequired,
        stale: payload.stale,
        missing,
        blockers: payload.blockers,
        sourceRequests: payload.sourceRequests,
        artifact: payload.artifact,
        selectedPayload: payload.selectedPayload,
        actionPayloads: payload.actionPayloads,
        actionReadiness: payload.actionReadiness,
    }

    return [publicTiHandoffCase({
        handoff,
        title: `Public TI: ${payload.artifact.label || payload.query}`,
        subtitle: selectedMissing.length ? selectedMissing.join('; ') : `${actionLabel(input.decode.action)} for ${payload.query}.`,
        severity,
        status: orgMissing ? 'org_required' : payload.stale ? 'stale_evidence' : selectedMissing.length ? 'blocked_dependencies' : 'ready_for_operator',
        priority: 540,
        confidence: typeof payload.artifact.confidence === 'number' ? payload.artifact.confidence : 72,
        updatedAt,
        evidence: publicTiEvidence(payload, now),
        timeline: [
            { id: 'public_ti_generated', at: payload.generatedAt || now, title: 'Actor evidence bridge generated', body: `${payload.query} exported ${actionLabel(input.decode.action)}.` },
            { id: 'public_ti_org_gate', at: now, title: organization ? 'Organization context live' : 'Organization context syncing', body: organization ? `${organization.name} (${organization.id}) is available for explicit mutations.` : 'Organization context is syncing before persisted mutations unlock.' },
            { id: 'public_ti_alert_state', at: input.operations?.latestRun?.updatedAt || now, title: input.liveAlertCount ? 'Alert generation live' : 'Alert generation checking', body: input.liveAlertCount ? `${input.liveAlertCount} live DWM alert(s) loaded for this workspace.` : input.operations ? 'Source state is live; alert state is updating for DWM alerts.' : 'Collection state is loading.' },
        ],
        workflowPath: [
            {
                id: 'public_ti_path_org',
                label: 'Organization',
                status: organization ? 'ready' : 'blocked',
                owner: organization ? 'operator' : 'platform',
                source: 'Organization roster',
                entityId: organization?.id,
                href: organization ? `/api/organizations/${encodeURIComponent(organization.id)}/members` : '/api/organizations',
                detail: organization ? `Mutations will use ${organization.name}.` : 'Explicit organization context is required before persistence.',
            },
            {
                id: 'public_ti_path_watchlist',
                label: 'Shared watchlist',
                status: watchlistCovered ? 'ready' : watchTerms.length ? 'needs_action' : 'blocked',
                owner: 'operator',
                source: 'Shared watchlist',
                entityId: watchTerms.map(term => term.value).join(', ') || undefined,
                href: '/api/findings/watchlists',
                detail: watchlistCovered ? 'selected record term is already covered by a loaded watchlist.' : watchTerms.length ? 'Add selected record terms to an organization watchlist.' : 'No watchlist terms came with this artifact.',
            },
            {
                id: 'public_ti_path_alerts',
                label: 'Alert generation',
                status: input.operations ? input.liveAlertCount ? 'ready' : 'needs_action' : 'blocked',
                owner: 'analyst',
                source: 'Collection and alert rebuild',
                href: '/api/findings/alerts',
                detail: input.operations ? `${input.operations.counts.activeSourceCount}/${input.operations.counts.sourceCount} active sources; ${input.liveAlertCount} saved alerts.` : 'Source stream reconnecting.',
            },
            {
                id: 'public_ti_path_source',
                label: 'Source pack',
                status: payload.sourceRequired ? 'needs_action' : 'ready',
                owner: 'source-ops',
                source: 'public TI sourceRequests',
                href: '/ti/sources',
                detail: payload.sourceRequests.length ? `${payload.sourceRequests.length} source request(s) require review.` : 'No additional source request was included.',
            },
        ],
        nextTasks: nextPublicTiTasks({ orgMissing, sourceBlocked, stale: payload.stale, watchTerms: watchTerms.length, selectedMissing, action: input.decode.action }),
        relatedLinks: [
            { href: '/ti', label: 'Public TI' },
            { href: '/findings', label: 'DWM console' },
            { href: '/ti/sources', label: 'Source ops' },
            { href: '/automation?setup=dwm', label: 'Delivery routes' },
        ],
    })]
}

