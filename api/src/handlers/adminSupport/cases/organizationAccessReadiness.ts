import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAccessRecoveryState } from './accessRecoveryState.ts'

export function supportOrganizationCaseAccessReadiness(input: {
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
    accessStatus: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    timeline: Array<Record<string, any>>
}) {
    const auditEventIds = input.timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id))
    const pendingInvites = input.invites.filter(invite => invite.status === 'pending')
    const activeMembers = input.members.filter(member => member.status === 'active' || member.active === true)
    const failedWebhookBlockers = Array.isArray(input.webhookDestinationReadiness.caseReadiness?.blockers)
        ? input.webhookDestinationReadiness.caseReadiness.blockers
        : []
    const { accessBlockers, recoveryBlockers, recoveryState } = supportAccessRecoveryState(input.accessStatus, input.accessRecoveryPlan)
    const blockers = uniqueTimelineValues([
        activeMembers.length ? '' : 'missing_active_member',
        input.watchlistItems.length || input.alertReferences.length ? '' : 'missing_alert_or_watchlist_evidence',
        input.webhookDestinations.length ? '' : 'missing_webhook_destination',
        auditEventIds.length ? '' : 'missing_case_audit_events',
        ...failedWebhookBlockers,
        ...accessBlockers,
        ...recoveryBlockers,
    ])
    return {
        schemaVersion: 'support.case_access_readiness.v1',
        generatedAt: new Date().toISOString(),
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason || null,
        supportContextPresent: Boolean(input.supportContext),
        status: blockers.length ? 'needs_review' : 'ready',
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        evidence: {
            activeMemberCount: activeMembers.length,
            pendingInviteCount: pendingInvites.length,
            watchlistItemCount: input.watchlistItems.length,
            alertReferenceCount: input.alertReferences.length,
            webhookDestinationCount: input.webhookDestinations.length,
            auditEventIds,
        },
        recoveryState,
        replayFilters: {
            current: auditFilterQuery({ org: input.organizationId, request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            members: auditFilterQuery({ org: input.organizationId, entityType: 'member', source: 'admin', service: 'hanasand-api' }),
            invites: auditFilterQuery({ org: input.organizationId, entityType: 'invite', source: 'admin', service: 'hanasand-api' }),
            watchlists: auditFilterQuery({ org: input.organizationId, action: 'watchlist', source: 'admin', service: 'hanasand-api' }),
            alerts: auditFilterQuery({ org: input.organizationId, action: 'alert', source: 'admin', service: 'hanasand-api' }),
            webhooks: auditFilterQuery({ org: input.organizationId, action: 'webhook', source: 'admin', service: 'hanasand-api' }),
            recovery: auditFilterQuery({ org: input.organizationId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: input.organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        },
        nextRoutes: {
            organizationInspection: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}`,
            inviteAssist: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites`,
            accessRecovery: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/access-recovery`,
            auditReplay: auditFilterQuery({ org: input.organizationId, request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            caseReplay: '/api/admin/support/receipt-replay',
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noLiveWebhookDelivery: true,
            noSecretExposure: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        forbiddenFields: ['endpoint_encrypted', 'endpointUrl', 'webhookUrl', 'secret', 'token', 'authorization', 'cookie', 'sessionToken', 'inviteToken'],
        denialStates: [
            'support_role_required',
            'missing_support_reason',
            'wrong_org_scope',
            'missing_active_member',
            'missing_alert_or_watchlist_evidence',
            'missing_webhook_destination',
            'webhook_destination_test_failed',
            'denied_recovery_approval',
            'redaction_required',
        ],
        blockers,
        copyText: [
            `Support case access readiness org=${input.organizationId}`,
            `Members: ${activeMembers.length}`,
            `Invites: ${pendingInvites.length}`,
            `Alerts/watchlists/webhooks: ${input.alertReferences.length}/${input.watchlistItems.length}/${input.webhookDestinations.length}`,
            `Replay: ${auditFilterQuery({ org: input.organizationId, request: input.requestId, source: 'admin', service: 'hanasand-api' })}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
