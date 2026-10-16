import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportCaseTimelineEvidence } from '../audit/auditCaseTimeline.ts'
import { isPlainObject } from '../audit/auditEventProjection.ts'

export function supportOrganizationCaseHandoff(input: {
    actorId: string
    organizationId: string
    requestId: string
    reason: string
    supportContext: string
    members: Array<Record<string, any>>
    invites: Array<Record<string, any>>
    watchlistItems: Array<Record<string, any>>
    alertReferences: Array<Record<string, any>>
    webhookDestinations: Array<Record<string, any>>
    webhookDestinationReadiness: Record<string, any>
    caseAccessReadiness: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    actionHistoryExport: Record<string, any>
    timeline: Array<Record<string, any>>
}) {
    const timelineSummary = supportCaseTimelineEvidence(input.timeline)
    const { auditEventIds } = timelineSummary
    const deliveryHistoryDiagnostic = isPlainObject(input.webhookDestinationReadiness.deliveryHistoryDiagnostic)
        ? input.webhookDestinationReadiness.deliveryHistoryDiagnostic as Record<string, any>
        : null
    const activeMembers = input.members.filter(member => member.status === 'active' || member.active === true)
    const removedMembers = input.members.filter(member => member.status === 'removed' || member.removed === true)
    const pendingInvites = input.invites.filter(invite => invite.status === 'pending')
    const recoveryContextDiagnostic = {
        schemaVersion: 'support.organization.recovery_context_diagnostic.v1',
        generatedAt: new Date().toISOString(),
        organizationId: input.organizationId,
        requestId: input.requestId,
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        activeMemberCount: activeMembers.length,
        removedMemberCount: removedMembers.length,
        pendingInviteCount: pendingInvites.length,
        replayFilters: {
            members: auditFilterQuery({ org: input.organizationId, entityType: 'member', source: 'admin', service: 'hanasand-api' }),
            invites: auditFilterQuery({ org: input.organizationId, entityType: 'invite', source: 'admin', service: 'hanasand-api' }),
            recovery: auditFilterQuery({ org: input.organizationId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            memberRecovery: auditFilterQuery({ org: input.organizationId, action: 'member_role_recovery', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: input.organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        },
        blockers: uniqueTimelineValues([
            activeMembers.length ? '' : 'missing_active_member',
            activeMembers.length || pendingInvites.length ? '' : 'missing_member_or_invite_access_evidence',
        ]),
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
    }
    const alertReadinessDiagnostic = {
        schemaVersion: 'support.organization.alert_readiness.case_diagnostic.v1',
        generatedAt: new Date().toISOString(),
        organizationId: input.organizationId,
        requestId: input.requestId,
        sourceWorkflow: 'alert',
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        expectedConsumer: 'case.replay',
        watchlistItemCount: input.watchlistItems.length,
        alertReferenceCount: input.alertReferences.length,
        alertReferenceIds: uniqueTimelineValues(input.alertReferences.map(reference => reference.id || reference.alertId || reference.watchlistItemId)),
        replayFilters: {
            alerts: auditFilterQuery({ org: input.organizationId, workflow: 'alert', action: 'alert', source: 'admin', service: 'hanasand-api' }),
            watchlists: auditFilterQuery({ org: input.organizationId, workflow: 'watchlist', action: 'watchlist', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: input.organizationId, workflow: 'alert', outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        },
        blockers: uniqueTimelineValues([
            input.watchlistItems.length ? '' : 'missing_watchlist_evidence',
            input.alertReferences.length ? '' : 'missing_alert_reference',
        ]),
        safeHandoff: {
            noLiveAccessGrant: true,
            noLiveWebhookDelivery: true,
            noSecretExposure: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
    }
    const recoveryBlockers = uniqueTimelineValues([
        ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        ...(Array.isArray(input.webhookDestinationReadiness.caseReadiness?.blockers) ? input.webhookDestinationReadiness.caseReadiness.blockers : []),
        ...(Array.isArray(deliveryHistoryDiagnostic?.blockers) ? deliveryHistoryDiagnostic.blockers : []),
        ...recoveryContextDiagnostic.blockers,
        ...alertReadinessDiagnostic.blockers,
    ])
    return {
        schemaVersion: 'support.organization.case_handoff.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        actorId: input.actorId,
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason || null,
        supportContextPresent: Boolean(input.supportContext),
        evidence: {
            watchlistItemCount: input.watchlistItems.length,
            alertReferenceCount: input.alertReferences.length,
            webhookDestinationCount: input.webhookDestinations.length,
            ...timelineSummary,
            caseAccessReadiness: input.caseAccessReadiness,
            recoveryContextDiagnostic,
            deliveryHistoryDiagnostic,
            alertReadinessDiagnostic,
        },
        recovery: {
            accessRecoveryAvailable: Boolean(input.accessRecoveryPlan.available || input.accessRecoveryPlan.items?.length),
            blockers: recoveryBlockers,
            actionHistorySchema: input.actionHistoryExport.schemaVersion || null,
            readinessMatrixSchema: input.actionHistoryExport.recoveryReadinessMatrix?.schemaVersion || null,
        },
        replayFilters: {
            current: auditFilterQuery({ org: input.organizationId, request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            recoveryContext: recoveryContextDiagnostic.replayFilters,
            alerts: auditFilterQuery({ org: input.organizationId, action: 'alert', source: 'admin', service: 'hanasand-api' }),
            watchlists: auditFilterQuery({ org: input.organizationId, action: 'watchlist', source: 'admin', service: 'hanasand-api' }),
            alertReadiness: alertReadinessDiagnostic.replayFilters,
            webhooks: auditFilterQuery({ org: input.organizationId, action: 'webhook', source: 'admin', service: 'hanasand-api' }),
            webhookDeliveries: Array.isArray(deliveryHistoryDiagnostic?.deliveryHistoryLinks) ? deliveryHistoryDiagnostic.deliveryHistoryLinks : [],
            webhookDeliveryAudit: deliveryHistoryDiagnostic?.auditFilters || null,
            recovery: auditFilterQuery({ org: input.organizationId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: input.organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        },
        nextRoutes: {
            supportInspection: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}`,
            auditTimeline: `/api/admin/audit-events?org=${encodeURIComponent(input.organizationId)}`,
            accessRecovery: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/access-recovery`,
            inviteAssist: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites`,
            webhookDeliveryHistory: `/api/dwm/webhook-deliveries?orgId=${encodeURIComponent(input.organizationId)}`,
        },
        forbiddenFields: ['endpoint_encrypted', 'endpointUrl', 'webhookUrl', 'secret', 'token', 'authorization', 'cookie'],
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noLiveWebhookDelivery: true,
            noSecretExposure: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'wrong_org_scope',
            'missing_case_evidence',
            'missing_member_or_invite_access_evidence',
            'missing_watchlist_evidence',
            'missing_alert_reference',
            'missing_webhook_delivery_history',
            'webhook_destination_test_failed',
            'denied_recovery_approval',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            auditEventIds.length ? '' : 'missing_case_audit_events',
            input.watchlistItems.length || input.webhookDestinations.length ? '' : 'missing_case_evidence',
            ...recoveryBlockers,
        ]),
        copyText: [
            `Support case handoff org=${input.organizationId}`,
            `Request: ${input.requestId}`,
            `Recovery context: members=${activeMembers.length} removed=${removedMembers.length} pendingInvites=${pendingInvites.length}`,
            `Evidence: watchlists=${input.watchlistItems.length} alerts=${input.alertReferences.length} webhooks=${input.webhookDestinations.length}`,
            `Alert readiness blockers: ${alertReadinessDiagnostic.blockers.join(', ') || 'none'}`,
            `Webhook deliveries observed: ${deliveryHistoryDiagnostic?.deliveryObservedCount ?? 0}`,
            `Audit events: ${auditEventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery({ org: input.organizationId, request: input.requestId, source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}
