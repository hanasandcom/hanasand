import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { supportAuditWorkflowName } from '../../audit/auditTemplates.ts'

export function supportInspectionReceiptReplayPacket(input: {
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    approvalDetails: Array<Record<string, any>>
    org: string
    user: string
    email: string
    request: string
    supportSession: string
    organizationIds: string[]
}) {
    const receiptContracts = [
        {
            name: 'Scoped session',
            schemaVersion: 'support.scoped_session.lifecycle_receipt.v1',
            actions: ['support.session.create', 'support.session.revoke', 'support.session.inspect'],
            requiredScope: ['allowedActions', 'scope', 'expiresAt'],
            nextRoute: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
        },
        {
            name: 'Invite assistance',
            schemaVersion: 'support.invite_assist.execution_receipt.v1',
            actions: ['support.organization.invite_assist'],
            requiredScope: ['invite:create'],
            nextRoute: input.organizationIds[0] ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationIds[0])}/invites` : null,
        },
        {
            name: 'Invite action',
            schemaVersion: 'support.invite_action.execution_receipt.v1',
            actions: ['support.organization.invite_resend', 'support.organization.invite_revoke'],
            requiredScope: ['invite:resend', 'invite:revoke'],
            nextRoute: input.organizationIds[0] ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationIds[0])}/invites/:inviteId/actions` : null,
        },
        {
            name: 'Access recovery',
            schemaVersion: 'support.access_recovery.execution_receipt.v1',
            actions: ['support.organization.access_recovery'],
            requiredScope: ['recovery:invite'],
            nextRoute: input.organizationIds[0] ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationIds[0])}/access-recovery` : null,
        },
        {
            name: 'Access recovery decision',
            schemaVersion: 'support.access_recovery.approval_decision.v1',
            actions: ['support.organization.access_recovery.approve', 'support.organization.access_recovery.deny'],
            requiredScope: ['recovery:approve', 'recovery:deny'],
            nextRoute: input.request ? `/api/admin/support/access-recovery/${encodeURIComponent(input.request)}` : null,
        },
        {
            name: 'Member role recovery',
            schemaVersion: 'support.action_execute.member_role_recovery.v1',
            actions: ['support.organization.member_role_recovery'],
            requiredScope: ['member:role_recovery'],
            nextRoute: input.organizationIds[0] && input.user ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationIds[0])}/members/${encodeURIComponent(input.user)}/role-recovery` : null,
        },
        {
            name: 'Impersonation',
            schemaVersion: 'support.impersonation.request.v1',
            actions: ['impersonation.start', 'impersonation.stop'],
            requiredScope: ['read_profile', 'read_org'],
            nextRoute: input.user ? '/api/impersonation/start' : null,
        },
    ]
    const eventIdsForActions = (actions: string[]) => input.timeline
        .filter(event => actions.some(action => text(event.actionType || event.action).includes(action)))
        .map(event => Number(event.id))
        .filter(id => Number.isFinite(id))
    const approvalRequestIds = uniqueTimelineValues([
        ...input.approvalDetails.map(approval => approval.requestId),
        input.request,
    ])
    const sourceWorkflows = uniqueTimelineValues(input.timeline.map(event => supportAuditWorkflowName(event)))
    const replayEntries = receiptContracts.map(contract => {
        const eventIds = eventIdsForActions(contract.actions)
        const actionReplay = contract.actions.map(action => auditFilterQuery({
            ...input.timelineFilter,
            action,
            org: input.org || input.organizationIds[0] || '',
            target: input.user || input.email,
            request: input.request,
        }))
        return {
            ...contract,
            eventIds,
            eventCount: eventIds.length,
            replay: {
                action: actionReplay,
                denied: contract.actions.map(action => auditFilterQuery({ ...input.timelineFilter, action, outcome: 'denied' })),
                failed: contract.actions.map(action => auditFilterQuery({ ...input.timelineFilter, action, outcome: 'failed' })),
                bySupportSession: input.supportSession ? contract.actions.map(action => auditFilterQuery({ supportSession: input.supportSession, action })) : [],
                byRequest: approvalRequestIds.map(requestId => auditFilterQuery({ request: requestId, action: contract.actions[0] })),
            },
            requiredFields: ['actorId', 'targetId', 'organizationId', 'requestId', 'reason', 'scope', 'expiresAt|durationMinutes', 'outcome', 'auditEventIds'],
            detailRoutes: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        }
    })
    const allEventIds = uniqueTimelineValues(replayEntries.flatMap(entry => entry.eventIds).map(String))
    return {
        schemaVersion: 'support.inspection.receipt_replay_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        receiptContracts: replayEntries,
        replay: {
            current: auditFilterQuery(input.timelineFilter),
            byOutcome: {
                success: auditFilterQuery({ ...input.timelineFilter, outcome: 'success' }),
                denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
                failed: auditFilterQuery({ ...input.timelineFilter, outcome: 'failed' }),
            },
            byEntity: input.timeline
                .map(event => text(event.entityId || event.entity?.id))
                .filter(Boolean)
                .slice(0, 25)
                .map(entity => auditFilterQuery({ entity, request: input.request })),
            bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }) : null,
            bySourceWorkflow: sourceWorkflows.map(workflow => auditFilterQuery({ ...input.timelineFilter, workflow, source: 'admin', service: 'hanasand-api' })),
        },
        workflowHandoff: {
            sourceWorkflows,
            alias: 'sourceWorkflow',
            replayFilter: 'workflow',
            safeForCaseReplay: true,
            noLiveAccessGrant: true,
            redacted: true,
        },
        receiptEventIds: allEventIds.map(id => Number(id)).filter(id => Number.isFinite(id)),
        denialCases: [
            'missing_support_reason',
            'support_role_required',
            'support_session_expired',
            'support_session_revoked',
            'support_session_scope_denied',
            'active_admin_available',
            'pending_approval_requires_decision',
            'denied_recovery_approval',
        ],
        nextRoutes: {
            supportSession: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
            approvalSearch: `/api/admin/support/access-recovery${input.request ? `?request=${encodeURIComponent(input.request)}` : ''}`,
            audit: auditFilterQuery(input.timelineFilter),
            details: allEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(id)}`),
        },
        blockers: uniqueTimelineValues([
            replayEntries.some(entry => entry.eventCount) ? '' : 'missing_receipt_audit_events',
            input.timelineFilter.unsupported.length ? 'unsupported_audit_filter' : '',
            input.supportSession || input.request || input.org || input.user || input.email ? '' : 'missing_receipt_search_target',
        ]),
        copyText: [
            `Support receipt replay request=${input.request || '*'} session=${input.supportSession || '*'}`,
            `Source workflows: ${sourceWorkflows.join(', ') || 'none'}`,
            `Receipt events: ${allEventIds.join(', ') || 'none'}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}
