import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { supportAuditWorkflowName } from '../../audit/auditTemplates.ts'

export function supportRecoveryLifecycleCleanupExport(input: {
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
    const lifecycleEvents = input.timeline.filter(event => {
        const actionType = text(event.actionType || event.action)
        return actionType.startsWith('support.session')
            || actionType.startsWith('impersonation.')
            || /invite|access_recovery|member_role_recovery|recovery/.test(actionType)
    })
    const eventIds = lifecycleEvents.map(event => Number(event.id)).filter(id => Number.isFinite(id))
    const actions = uniqueTimelineValues(lifecycleEvents.map(event => event.actionType || event.action))
    const requestIds = uniqueTimelineValues([input.request, ...lifecycleEvents.map(event => event.requestId)])
    const entityIds = uniqueTimelineValues([input.entity, ...lifecycleEvents.map(event => event.entity?.id || event.entityId)])
    const supportSessionIds = uniqueTimelineValues([input.supportSession, ...lifecycleEvents.map(event => event.actionEvidence?.supportSessionId || event.context?.supportSessionId)])
    const sourceWorkflows = uniqueTimelineValues(lifecycleEvents.map(event => supportAuditWorkflowName(event)))
    const denialReasonCodes = uniqueTimelineValues(lifecycleEvents.flatMap(event => [
        event.actionEvidence?.blockerCode,
        event.actionEvidence?.blockers,
        event.context?.blockerCode,
        event.context?.blocker,
    ].flat()))
    const staleEvents = lifecycleEvents.filter(event => {
        const actionType = text(event.actionType || event.action)
        const context = event.context || {}
        const blockerText = text([
            event.actionEvidence?.blockerCode,
            event.actionEvidence?.blockers,
            context.blockerCode,
            context.blocker,
        ].flat().join(' '))
        return /stale_prepare_payload|stale_handoff|duplicate_idempotency_key/.test(blockerText)
            || /prepare|handoff/.test(actionType)
    })
    const expiredSessionEvents = lifecycleEvents.filter(event => {
        const blockerText = text([
            event.actionEvidence?.blockerCode,
            event.actionEvidence?.blockers,
            event.context?.blockerCode,
            event.context?.blocker,
        ].flat().join(' '))
        return blockerText.includes('support_session_expired')
    })
    const revokedSessionEvents = lifecycleEvents.filter(event => {
        const blockerText = text([
            event.actionEvidence?.blockerCode,
            event.actionEvidence?.blockers,
            event.context?.blockerCode,
            event.context?.blocker,
        ].flat().join(' '))
        return blockerText.includes('support_session_revoked') || text(event.actionType || event.action).includes('support.session.revoke')
    })
    const deniedRecoveryEvents = lifecycleEvents.filter(event => text(event.outcome) === 'denied' || text(event.actionType || event.action).includes('access_recovery.deny'))
    const inviteCleanupEvents = lifecycleEvents.filter(event => /invite/.test(text(event.actionType || event.action)))
    const blockers = uniqueTimelineValues([
        lifecycleEvents.length ? '' : 'missing_recovery_lifecycle_events',
        staleEvents.length ? 'review_stale_support_handoff' : '',
        expiredSessionEvents.length ? 'review_expired_support_session' : '',
        revokedSessionEvents.length ? 'review_revoked_support_session' : '',
        deniedRecoveryEvents.length ? 'review_denied_recovery' : '',
        denialReasonCodes.includes('redaction_required') ? 'redaction_required' : '',
    ])
    return {
        schemaVersion: 'support.recovery.lifecycle_cleanup_export.v1',
        generatedAt: new Date().toISOString(),
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
        reviewQueues: {
            staleHandoffs: staleEvents.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
            expiredSupportSessions: expiredSessionEvents.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
            revokedSupportSessions: revokedSessionEvents.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
            deniedRecovery: deniedRecoveryEvents.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
            inviteCleanup: inviteCleanupEvents.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
        },
        audit: {
            eventIds,
            actions,
            requestIds,
            entityIds,
            supportSessionIds,
            sourceWorkflows,
            denialReasonCodes,
            filter: input.timelineFilter,
            replayFilters: {
                current: auditFilterQuery(input.timelineFilter),
                staleHandoffs: auditFilterQuery({ org: input.org, target: input.user || input.email, request: input.request, blocker: 'stale_prepare_payload', source: 'admin', service: 'hanasand-api' }),
                expiredSessions: auditFilterQuery({ org: input.org, target: input.user || input.email, supportSession: input.supportSession, blocker: 'support_session_expired', source: 'admin', service: 'hanasand-api' }),
                revokedSessions: auditFilterQuery({ org: input.org, target: input.user || input.email, supportSession: input.supportSession, action: 'support.session.revoke', source: 'admin', service: 'hanasand-api' }),
                deniedRecovery: auditFilterQuery({ org: input.org, target: input.user || input.email, action: 'support.organization.access_recovery', outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
                byRequest: requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
                bySourceWorkflow: sourceWorkflows.map(workflow => auditFilterQuery({ ...input.timelineFilter, workflow, source: 'admin', service: 'hanasand-api' })),
            },
            sourceWorkflowHandoff: {
                alias: 'sourceWorkflow',
                workflows: sourceWorkflows,
                safeForCaseReplay: true,
                noLiveAccessGrant: true,
                redacted: true,
            },
        },
        cleanupPolicy: {
            mutationAllowed: false,
            operatorReviewRequired: blockers.length > 0,
            safeToExportToCaseReplay: true,
            requiresFreshReasonBeforeRetry: true,
            requiresFreshScopedSessionBeforeImpersonation: true,
            noSilentInviteReactivation: true,
            noSilentMembershipMutation: true,
        },
        nextRoutes: {
            readiness: '/api/admin/support/readiness',
            receiptReplay: '/api/admin/support/receipt-replay',
            supportInspection: auditFilterQuery({
                org: input.org,
                target: input.user || input.email,
                request: input.request,
                entity: input.entity,
                supportSession: input.supportSession,
                workflow: sourceWorkflows[0] || '',
            }).replace('/api/admin/audit-events', '/api/admin/support/inspect'),
            auditReplay: auditFilterQuery(input.timelineFilter),
            accessRecovery: input.org ? `/api/admin/support/organizations/${encodeURIComponent(input.org)}/access-recovery` : null,
            supportSession: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
        },
        requiredAuditFields: ['actor.id', 'target.id', 'organization.id', 'entity.id', 'requestId', 'reason', 'outcome', 'severity', 'timestamp', 'actionEvidence.supportSessionId', 'actionEvidence.workflow'],
        forbiddenFields: ['token', 'secret', 'authorization', 'cookie', 'webhookUrl', 'privateSourceUrl', 'sessionToken', 'inviteToken'],
        blockers,
        copyText: [
            `Support recovery lifecycle cleanup org=${input.org || '*'} target=${input.user || input.email || '*'} request=${input.request || '*'}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Source workflows: ${sourceWorkflows.join(', ') || 'none'}`,
            `Stale/expired/revoked/denied: ${staleEvents.length}/${expiredSessionEvents.length}/${revokedSessionEvents.length}/${deniedRecoveryEvents.length}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
