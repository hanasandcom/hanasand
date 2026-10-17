import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { normalizeInviteInput, type OrganizationInviteRow } from '#utils/organizations.ts'
import { supportInviteAssistAuditQuery, supportInviteAssistExecutorControls } from './executor.ts'

export function supportInviteAssistExecutionReceipt(input: {
    actorId: string
    organizationId: string
    requestId: string
    reason: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    input: ReturnType<typeof normalizeInviteInput>
    invites: OrganizationInviteRow[]
    inviteIds: string[]
    outcome: 'success' | 'denied'
    auditEventIds: number[]
    blockers: string[]
}) {
    const entityId = input.inviteIds.join(',')
    return {
        schemaVersion: 'support.invite_assist.execution_receipt.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        expiryRequired: true,
        noSilentMembershipMutation: true,
        mutationMode: 'controlled_invite_row_only',
        action: 'invite_assist',
        actionType: 'support.organization.invite_assist',
        outcome: input.outcome,
        severity: 'notice',
        actorId: input.actorId,
        organizationId: input.organizationId,
        targetType: 'organization',
        targetId: input.organizationId,
        entityId,
        inviteIds: input.inviteIds,
        emails: input.invites.map(invite => invite.email),
        role: input.input.role,
        expiresAt: input.input.expiresAt,
        requestId: input.requestId,
        reason: input.reason,
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        auditEventIds: input.auditEventIds,
        audit: {
            detailRoutes: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            replay: supportInviteAssistAuditQuery({
                requestId: input.requestId,
                organizationId: input.organizationId,
                entityId,
                correlationId: input.controls.correlationId,
                idempotencyKey: input.controls.idempotencyKey,
                reason: input.reason,
            }),
            byTargetType: auditFilterQuery({ targetType: 'organization', org: input.organizationId, entity: entityId, request: input.requestId }),
            byInviteTargetType: input.inviteIds.map(inviteId => auditFilterQuery({ targetType: 'invite', entity: inviteId, request: input.requestId })),
            deniedReplay: auditFilterQuery({ targetType: 'organization', org: input.organizationId, action: 'support.organization.invite_assist', outcome: 'denied', request: input.requestId }),
        },
        blockers: input.blockers,
        copyText: [
            `Support invite assistance receipt ${input.inviteIds.join(', ') || 'none'}`,
            `Request: ${input.requestId}`,
            `Expires: ${input.input.expiresAt}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Replay: ${auditFilterQuery({ targetType: 'organization', org: input.organizationId, entity: entityId, request: input.requestId })}`,
        ].join('\n'),
    }
}
