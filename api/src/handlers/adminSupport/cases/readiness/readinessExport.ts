import { auditFilterQuery, uniqueTimelineValues, type SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { supportAuditFilterContract } from '../../audit/auditFilterPackets.ts'
import { supportAuditExportProof } from '../../audit/auditExportPackets.ts'
import { supportAuditBridgeAdapterContract } from '../../audit/auditBridgePackets.ts'
import { supportCaseTimelineEntries } from '../../audit/auditCaseTimeline.ts'
import { supportRecoveryLifecycleCleanupExport } from './lifecycleCleanupExport.ts'
import { supportReadinessCaseTimelineExport } from './caseTimelineExport.ts'
import { supportRecoveryReadinessMatrix } from './readinessMatrix.ts'
import { supportRecoveryCaseReplayFixture } from './caseReplayFixture.ts'
import { supportReadinessWorkflowContracts } from './workflowContracts.ts'
import { supportReadinessReplayFilters, supportReadinessNextRoutes } from './readinessLinks.ts'
import { supportReadinessReceiptSchemas, supportReadinessDenialCases, supportReadinessProductMetadata } from './readinessMetadata.ts'

export function supportReadinessExport(input: {
    actorId: string
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    org: string
    user: string
    email: string
    request: string
    entity: string
    entityType: string
    supportSession: string
}) {
    const eventIds = input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const actions = uniqueTimelineValues(input.timeline.map(event => event.action || event.actionType))
    const outcomes = uniqueTimelineValues(input.timeline.map(event => event.outcome))
    const caseTimelineEntries = supportCaseTimelineEntries(input.timeline)
    const lifecycleCleanupExport = supportRecoveryLifecycleCleanupExport({
        actorId: input.actorId,
        timelineFilter: input.timelineFilter,
        timeline: input.timeline,
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        entity: input.entity,
        entityType: input.entityType,
        supportSession: input.supportSession,
    })
    const requestIds = uniqueTimelineValues([
        input.request,
        ...input.timeline.map(event => event.requestId),
    ])
    const entityIds = uniqueTimelineValues([
        input.entity,
        ...input.timeline.map(event => event.entity?.id || event.entityId),
    ])
    const blockers = uniqueTimelineValues([
        eventIds.length ? '' : 'audit_unavailable',
        input.timelineFilter.unsupported.length ? 'audit_filter_unavailable' : '',
    ])
    return {
        schemaVersion: 'support.readiness_export.v1',
        generatedAt: new Date().toISOString(),
        status: blockers.length ? 'needs_action' : 'ready',
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        actorId: input.actorId,
        target: {
            organizationId: input.org || null,
            targetUserId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            entityId: input.entity || null,
            entityType: input.entityType || null,
            supportSessionId: input.supportSession || null,
        },
        audit: {
            eventIds,
            actions,
            outcomes,
            requestIds,
            entityIds,
            filter: input.timelineFilter,
            filterContract: supportAuditFilterContract(input.timelineFilter, input.timeline),
            exportProof: supportAuditExportProof(input.timelineFilter, input.timeline),
            replayFilters: supportReadinessReplayFilters({
                timelineFilter: input.timelineFilter,
                supportSession: input.supportSession,
                requestIds,
                entityIds,
                actions,
                outcomes,
                org: input.org,
                user: input.user,
                email: input.email,
            }),
        },
        supportWorkflows: supportReadinessWorkflowContracts(input.supportSession),
        orgWebhookRecoveryReadiness: {
            schemaVersion: 'support.org_webhook_recovery.readiness_bridge.v1',
            consumesContracts: [
                'organization.worker3_ui_readiness_proof.v1',
                'dwm.webhook.destination_admin_product_progress.v1',
                'support.organization.alert_readiness.audit_bridge.v1',
            ],
            auditBridge: supportAuditBridgeAdapterContract({ org: input.org, target: input.user || input.email, request: input.request, supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }),
            recoveryBlockers: [
                'active_admin_available',
                'missing_support_reason',
                'support_session_revoked',
                'support_session_expired',
                'denied_recovery_approval',
                'duplicate_idempotency_key',
                'audit_unavailable',
                'redaction_required',
            ],
            noCrossOrgLeakage: true,
        },
        caseTimelineExport: supportReadinessCaseTimelineExport({
            actorId: input.actorId,
            org: input.org,
            user: input.user,
            email: input.email,
            request: input.request,
            entity: input.entity,
            entityType: input.entityType,
            supportSession: input.supportSession,
            timelineFilter: input.timelineFilter,
            entries: caseTimelineEntries,
        }),
        caseReplayFixture: supportRecoveryCaseReplayFixture({
            actorId: input.actorId,
            org: input.org,
            user: input.user,
            email: input.email,
            request: input.request,
            entity: input.entity,
            entityType: input.entityType,
            supportSession: input.supportSession,
            timelineFilter: input.timelineFilter,
            timeline: input.timeline,
            eventIds,
            actions,
            outcomes,
            requestIds,
            entityIds,
        }),
        lifecycleCleanupExport,
        recoveryReadinessMatrix: supportRecoveryReadinessMatrix({
            actorId: input.actorId,
            org: input.org,
            user: input.user,
            email: input.email,
            request: input.request,
            entity: input.entity,
            entityType: input.entityType,
            supportSession: input.supportSession,
            timelineFilter: input.timelineFilter,
            timeline: input.timeline,
            eventIds,
            actions,
            outcomes,
            requestIds,
            entityIds,
        }),
        receiptSchemas: supportReadinessReceiptSchemas,
        nextRoutes: supportReadinessNextRoutes(input.timelineFilter, eventIds, input.supportSession),
        denialCases: supportReadinessDenialCases,
        blockers,
        productReadiness: supportReadinessProductMetadata,
        copyText: [
            `Support readiness: ${blockers.length ? 'needs_action' : 'ready'}`,
            `Actor: ${input.actorId}`,
            `Target org=${input.org || '*'} user=${input.user || '*'} request=${input.request || '*'} session=${input.supportSession || '*'}`,
            `Audit events: ${eventIds.join(', ') || 'none'}`,
            `Case timeline entries: ${caseTimelineEntries.length}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
