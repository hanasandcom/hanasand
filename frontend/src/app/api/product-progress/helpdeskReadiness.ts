import type { FetchResult } from './routeHelpers'
import type { HelpdeskAuditReadiness } from '@/utils/productProgress/readinessTypes'
import { rows, latestTimestamp } from './routeHelpers'

export function helpdeskAuditReadiness(input: {
    generatedAt: string
    recoveryRoute: string
    auditRoute: string
    recovery: FetchResult
    audit: FetchResult
}): HelpdeskAuditReadiness {
    const approvals = rows((input.recovery.json as { approvals?: unknown[] } | undefined)?.approvals)
    const auditEvents = rows((input.audit.json as { events?: unknown[] } | undefined)?.events)
    const auditExportProof = supportAuditExportProof(input.audit)
    const openRecoveryRequests = approvals.filter(item => {
        const status = String(item.status || item.outcome || '').toLowerCase()
        return status === 'pending' || status === 'open' || status === 'requested'
    }).length
    const supportQueueDepth = approvals.length
    const latestAuditEventAt = latestTimestamp(auditEvents.map(item => String(item.createdAt || item.timestamp || item.at || '')))
    const auditProofBlockers = blockersFromSupportProof(auditExportProof)
    const auditedActions = typeof auditExportProof?.eventCount === 'number' ? auditExportProof.eventCount : auditEvents.length
    const blockers = [
        input.recovery.ok ? '' : input.recovery.error || `Support recovery route returned HTTP ${input.recovery.status}.`,
        input.audit.ok ? '' : input.audit.error || `Admin audit route returned HTTP ${input.audit.status}.`,
        auditExportProof ? '' : 'Admin audit route did not return support.audit.export_proof.v1.',
        auditedActions > 0 ? '' : 'No admin audit events were returned for support readiness.',
        ...auditProofBlockers,
    ].filter(Boolean)
    const replayQuery = auditExportProof?.replay?.query
    const auditExportRoute = auditExportProof?.worker3?.route

    return {
        schemaVersion: 'support.audit.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: `${input.recoveryRoute} + ${input.auditRoute}`,
        href: '/helpdesk',
        auditedActions,
        openRecoveryRequests,
        supportQueueDepth,
        latestAuditEventAt,
        blockers,
        ownerLane: 'helpdesk',
        unavailableReason: blockers.length ? 'missing_helpdesk_audit_readiness_api' : undefined,
        staleAfterSeconds: 3600,
        proofTimestamp: auditExportProof?.generatedAt || latestAuditEventAt || input.generatedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: [
            'GET /api/backend/admin/support/access-recovery must return recovery queue state.',
            'GET /api/backend/admin/audit-events?limit=50 must return detail.exportProof.schemaVersion=support.audit.export_proof.v1.',
            replayQuery ? `Replay query: ${replayQuery}.` : '',
            auditExportRoute ? `Audit export route: ${auditExportRoute}.` : '',
        ].filter(Boolean).join(' '),
        backendProofContractVersion: auditExportProof?.schemaVersion || 'support.audit.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `${auditedActions} audited support action${auditedActions === 1 ? '' : 's'} and ${supportQueueDepth} recovery record${supportQueueDepth === 1 ? '' : 's'} loaded with a redacted export event.`,
    }
}

type SupportAuditExportProof = {
    schemaVersion: 'support.audit.export_proof.v1'
    generatedAt?: string
    eventCount?: number
    blockers?: string[]
    replay?: {
        query?: string
    }
    worker3?: {
        readinessName?: string
        route?: string
        expectedResponsePath?: string
    }
}

function supportAuditExportProof(result: FetchResult): SupportAuditExportProof | undefined {
    const payload = result.json as { detail?: { exportProof?: unknown } } | undefined
    const proof = payload?.detail?.exportProof
    if (!proof || typeof proof !== 'object') return undefined
    const candidate = proof as Partial<SupportAuditExportProof>
    if (candidate.schemaVersion !== 'support.audit.export_proof.v1') return undefined
    return candidate as SupportAuditExportProof
}

function blockersFromSupportProof(proof: SupportAuditExportProof | undefined) {
    return Array.isArray(proof?.blockers) ? proof.blockers.filter(Boolean).map(String) : []
}

