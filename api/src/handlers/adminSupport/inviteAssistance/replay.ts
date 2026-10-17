import type { FastifyReply } from 'fastify'
import { toInvite, toOrganization, type OrganizationRow, normalizeInviteInput } from '#utils/organizations.ts'
import { supportInviteAssistAuditQuery, supportInviteAssistExecutorControls, supportInviteAssistExecutorDetail } from './executor.ts'
import { supportInviteAssistExecutionReceipt } from './receipt.ts'
import { auditContextInviteIds, loadOrganizationInvitesByIds } from './storage.ts'

export async function sendInviteAssistanceReplay(input: {
    res: FastifyReply
    actorId: string
    organization: OrganizationRow
    reason: string
    inviteInput: ReturnType<typeof normalizeInviteInput>
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    duplicate: { id: number | string; request_id: string; subject_id?: string | null; context: Record<string, unknown> }
}) {
    const { res, actorId, organization, reason, inviteInput, controls, duplicate } = input
    const duplicateInviteIds = auditContextInviteIds(duplicate.context)
    const duplicateInvites = await loadOrganizationInvitesByIds(organization.id, duplicateInviteIds)

    return res.send({
        invites: duplicateInvites.map(toInvite),
        inviteAssistance: {
            schemaVersion: 'support.invite_assist.v1',
            requestId: duplicate.request_id,
            actorId: actorId,
            organization: toOrganization(organization),
            invites: duplicateInvites.map(toInvite),
            reason,
            scope: {
                organizationId: organization.id,
                inviteIds: duplicateInviteIds,
                role: duplicateInvites[0]?.role || inviteInput.role,
                expiresAt: duplicateInvites[0]?.expires_at || inviteInput.expiresAt,
            },
            outcome: 'success',
            idempotentReplay: true,
            blockers: ['duplicate_idempotency_key'],
            auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
            noSilentMembershipMutation: true,
            controlledExecutor: supportInviteAssistExecutorDetail({
                organizationId: organization.id,
                requestId: duplicate.request_id,
                reason,
                controls: controls,
                input: inviteInput,
                inviteIds: duplicateInviteIds,
                outcome: 'success',
                blockers: ['duplicate_idempotency_key'],
            }),
            executionReceipt: supportInviteAssistExecutionReceipt({
                actorId: actorId,
                organizationId: organization.id,
                requestId: duplicate.request_id,
                reason,
                controls: controls,
                input: inviteInput,
                invites: duplicateInvites,
                inviteIds: duplicateInviteIds,
                outcome: 'success',
                auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                blockers: ['duplicate_idempotency_key'],
            }),
            audit: {
                actionType: 'support.organization.invite_assist',
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: 'notice',
                eventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                query: supportInviteAssistAuditQuery({
                    requestId: duplicate.request_id,
                    organizationId: organization.id,
                    entityId: duplicate.subject_id || duplicateInviteIds.join(','),
                    correlationId: controls.correlationId,
                    idempotencyKey: controls.idempotencyKey,
                    reason,
                }),
            },
            copyText: [
                `Support invite assistance already executed for ${duplicateInvites.map(row => row.email).join(', ') || inviteInput.emails.join(', ')}`,
                `Org: ${organization.name} (${organization.id})`,
                `Request: ${duplicate.request_id}`,
                `Idempotency: ${controls.idempotencyKey}`,
                `Audit events: ${duplicate.id}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}
