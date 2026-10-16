import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditFilterContract } from '../audit/auditFilterPackets.ts'
import { supportAuditExportProof } from '../audit/auditExportPackets.ts'
export function supportOrgUserInspectionReceipt(input: {
    kind: 'organization' | 'user'
    actorId: string
    targetId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    accessStatus: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    supportSession: string
    nextRoutes: Record<string, string | null>
}) {
    const targetType = input.kind === 'organization' ? 'organization' : 'user'
    const eventIds = input.timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id))
    const organizationId = input.kind === 'organization'
        ? input.targetId
        : input.organizationIds[0] || ''
    const actionType = input.kind === 'organization'
        ? 'support.organization.inspect'
        : 'support.user.inspect'
    return {
        schemaVersion: `support.${input.kind}.inspection_receipt.v1`,
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        reasonRecommended: true,
        contextRecommended: true,
        action: `${input.kind}.inspect`,
        actionType,
        outcome: 'success',
        severity: 'info',
        actorId: input.actorId,
        targetType,
        targetId: input.targetId,
        organizationId: organizationId || null,
        organizationIds: input.organizationIds,
        entityId: input.targetId,
        requestId: input.requestId,
        reason: input.reason || null,
        reasonPresent: Boolean(input.reason),
        supportContextPresent: Boolean(input.supportContext),
        scope: input.kind === 'organization' ? ['read_org'] : ['read_profile', 'read_org'],
        supportSessionId: input.supportSession || null,
        accessStatus: {
            overall: input.accessStatus.overall || null,
            blockers: input.accessStatus.blockers || [],
            recoveryEligible: Boolean(input.accessRecoveryPlan?.available || input.accessRecoveryPlan?.items?.length),
        },
        auditEventIds: eventIds,
        audit: {
            replay: auditFilterQuery(input.timelineFilter),
            byAction: auditFilterQuery({ ...input.timelineFilter, action: actionType }),
            byEntity: auditFilterQuery({ entity: input.targetId, entityType: targetType, request: input.requestId }),
            byOutcome: {
                success: auditFilterQuery({ ...input.timelineFilter, outcome: 'success' }),
                denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
                failed: auditFilterQuery({ ...input.timelineFilter, outcome: 'failed' }),
            },
            bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, action: actionType }) : null,
            detailRoutes: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            filterContract: supportAuditFilterContract(input.timelineFilter, input.timeline),
            exportProof: supportAuditExportProof(input.timelineFilter, input.timeline),
        },
        receiptSchemas: [
            `support.${input.kind}.inspection_receipt.v1`,
            'support.inspection.audit_detail_packet.v1',
            'support.inspection.receipt_replay_packet.v1',
            'support.access_recovery.execution_receipt.v1',
            'support.scoped_session.lifecycle_receipt.v1',
        ],
        nextRoutes: {
            ...input.nextRoutes,
            receiptReplay: auditFilterQuery(input.timelineFilter),
            supportSession: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
        },
        denialCases: [
            'support_role_required',
            'support_auth_required',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_expired',
            'support_session_revoked',
            'missing_support_target',
            'support_target_not_found',
        ],
        blockers: uniqueTimelineValues([
            eventIds.length ? '' : 'missing_inspection_audit_events',
            input.reason ? '' : 'missing_operator_reason',
            input.organizationIds.length || input.kind === 'user' ? '' : 'missing_organization_scope',
            ...(Array.isArray(input.accessStatus.blockers) ? input.accessStatus.blockers : []),
        ]),
        copyText: [
            `Support ${input.kind} inspection receipt ${input.targetId}`,
            `Request: ${input.requestId}`,
            `Organizations: ${input.organizationIds.join(', ') || '*'}`,
            `Audit events: ${eventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}
