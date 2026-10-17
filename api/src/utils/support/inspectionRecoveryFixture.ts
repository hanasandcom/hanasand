import { auditFilterQuery, uniqueTimelineValues, type SupportInspectionPacket, type SupportTimelineFilter } from './inspectionPacketShared.ts'
import { supportText as text } from './adminSupportInput.ts'

export function supportInspectionRecoveryFixturePacket(input: {
    org: string
    user: string
    email: string
    request: string
    supportSession: string
    accessRecoveryPlan: Record<string, any>
    workbench: Record<string, any>
    timelineFilter: SupportTimelineFilter
}): SupportInspectionPacket {
    const requestId = input.request || 'support-request-id'
    const targetEmail = input.email || 'customer@example.com'
    const targetUserId = input.user || 'target-user-id'
    const reason = 'Verified customer access recovery request with scoped support approval.'
    const supportContext = 'Support case notes, requester verification, and operator identity.'
    const planItems = Array.isArray(input.accessRecoveryPlan.items) ? input.accessRecoveryPlan.items : []
    const fixtures = planItems.flatMap((item: Record<string, any>) => {
        const organizationId = text(item.organizationId || input.org) || 'organization-id'
        const operations = item.guardedOperations || {}
        const pendingInvite = item.inviteState?.pending?.[0] || null
        const inviteId = text(pendingInvite?.id) || 'invite-id'
        const baseBody = {
            reason,
            context: supportContext,
            requestId,
            supportSessionId: input.supportSession || undefined,
        }
        return [
            {
                name: 'invite_resend_prepare',
                method: 'POST',
                route: operations.inviteResend?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
                body: {
                    ...baseBody,
                    action: 'resend',
                    scope: 'invite:resend',
                    idempotencyKey: `support-${organizationId}-invite-resend`,
                },
                available: Boolean(operations.inviteResend?.available),
                expectedAuditAction: 'support.organization.invite_resend',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.invite_resend', request: requestId, entity: inviteId }),
            },
            {
                name: 'invite_revoke_prepare',
                method: 'POST',
                route: operations.inviteRevoke?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
                body: {
                    ...baseBody,
                    action: 'revoke',
                    scope: 'invite:revoke',
                    idempotencyKey: `support-${organizationId}-invite-revoke`,
                },
                available: Boolean(operations.inviteRevoke?.available),
                expectedAuditAction: 'support.organization.invite_revoke',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.invite_revoke', request: requestId, entity: inviteId }),
            },
            {
                name: 'controlled_recovery_invite_prepare',
                method: 'POST',
                route: operations.controlledRecoveryInvite?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery`,
                body: {
                    ...baseBody,
                    email: targetEmail,
                    role: 'admin',
                    scope: 'recovery:invite',
                    expiresAt: 'future ISO timestamp',
                },
                available: Boolean(operations.controlledRecoveryInvite?.available),
                expectedAuditAction: 'support.organization.access_recovery',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.access_recovery', request: requestId, target: targetEmail }),
            },
            {
                name: 'member_role_recovery_prepare',
                method: 'POST',
                route: operations.memberRoleRecovery?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(targetUserId)}/role-recovery`,
                body: {
                    ...baseBody,
                    role: 'admin',
                    scope: 'member:role_recovery',
                },
                available: Boolean(operations.memberRoleRecovery?.available),
                expectedAuditAction: 'support.organization.member_role_recovery',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.member_role_recovery', request: requestId, target: targetUserId }),
            },
        ]
    })
    const impersonationFixture = {
        name: 'impersonation_prepare',
        method: 'POST',
        route: '/api/impersonation/start',
        body: {
            reason,
            context: supportContext,
            requestId,
            targetUserId,
            organizationId: input.org || input.accessRecoveryPlan.target?.organizationIds?.[0] || 'organization-id',
            scope: ['read_profile', 'read_org'],
            durationMinutes: 30,
            supportSessionId: input.supportSession || undefined,
        },
        available: Boolean(input.workbench.impersonationAssistance?.eligible),
        expectedAuditAction: 'impersonation.start',
        auditReplay: auditFilterQuery({ action: 'impersonation.start', request: requestId, target: targetUserId }),
    }
    const allFixtures = [...fixtures, impersonationFixture]
    return {
        schemaVersion: 'support.inspection.recovery_fixture_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        purpose: 'support_workbench_recovery_and_impersonation_validation',
        target: {
            organizationIds: input.accessRecoveryPlan.target?.organizationIds || [],
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        requiredFields: ['reason', 'context', 'scope', 'requestId', 'idempotencyKey|durationMinutes|expiresAt'],
        fixtures: allFixtures,
        audit: {
            currentReplay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            expectedActions: uniqueTimelineValues(allFixtures.map(fixture => fixture.expectedAuditAction)),
            expectedRequestId: requestId,
        },
        blockers: uniqueTimelineValues([
            planItems.length ? '' : 'missing_access_recovery_plan_items',
            allFixtures.some(fixture => fixture.available) ? '' : 'no_available_support_recovery_action',
            ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        ]),
        copyText: [
            `Support recovery fixtures request=${requestId} user=${input.user || '*'} email=${input.email || '*'}`,
            `Fixtures: ${allFixtures.map(fixture => fixture.name).join(', ')}`,
            `Expected actions: ${uniqueTimelineValues(allFixtures.map(fixture => fixture.expectedAuditAction)).join(', ')}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}
