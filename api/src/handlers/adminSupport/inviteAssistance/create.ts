import { randomUUID } from 'crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { touchOrganization, upsertOrganizationInvite } from '#utils/db/identityDataWrites.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'
import { toInvite, toOrganization, normalizeInviteInput, type OrganizationInviteRow, type OrganizationRow } from '#utils/organizations.ts'
import { supportInviteAssistAuditQuery, supportInviteAssistExecutorControls, supportInviteAssistExecutorDetail } from './executor.ts'
import { supportInviteAssistExecutionReceipt } from './receipt.ts'

export async function createSupportInvites(input: {
    req: FastifyRequest
    res: FastifyReply
    actorId: string
    organization: OrganizationRow
    reason: string
    inviteInput: ReturnType<typeof normalizeInviteInput>
    requestId: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    supportContext: string
}) {
    const { req, res, actorId, organization, reason, inviteInput, requestId, controls, supportContext } = input
    const rows: OrganizationInviteRow[] = []
    for (const email of inviteInput.emails) {
        const invite = await upsertOrganizationInvite({
            id: randomUUID(), organizationId: organization.id, email,
            role: inviteInput.role, invitedBy: actorId, expiresAt: inviteInput.expiresAt,
        })
        rows.push(invite as OrganizationInviteRow)
    }

    const inviteIds = rows.map(row => row.id)
    const entityId = inviteIds.join(',')
    await touchOrganization(organization.id)
    await recordSystemEvent(req, {
        actionType: 'support.organization.invite_assist',
        actorId: actorId,
        targetType: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        entityId,
        requestId,
        severity: 'notice',
        outcome: 'success',
        reason,
        context: {
            schemaVersion: 'support.invite_assist.v1',
            requestId,
            organizationId: organization.id,
            emails: rows.map(row => row.email),
            role: inviteInput.role,
            expiresAt: inviteInput.expiresAt,
            inviteIds,
            correlationId: controls.correlationId,
            idempotencyKey: controls.idempotencyKey,
            supportSessionId: controls.supportSessionId || null,
            scope: controls.scope,
            handoffExpiresAt: controls.handoffExpiresAt,
            executor: supportInviteAssistExecutorDetail({
                organizationId: organization.id,
                requestId,
                reason,
                controls: controls,
                input: inviteInput,
                inviteIds,
                outcome: 'success',
                blockers: [],
            }),
            noSilentMembershipMutation: true,
            mutation: 'invite_row_only',
            supportContext,
        },
    })
    const auditEventIds = await loadSystemEventIds({
        requestId,
        actionType: 'support.organization.invite_assist',
        entityId,
    })

    return res.status(201).send({
        invites: rows.map(toInvite),
        inviteAssistance: {
            schemaVersion: 'support.invite_assist.v1',
            requestId,
            actorId: actorId,
            organization: toOrganization(organization),
            invites: rows.map(toInvite),
            reason,
            controlledExecutor: supportInviteAssistExecutorDetail({
                organizationId: organization.id,
                requestId,
                reason,
                controls: controls,
                input: inviteInput,
                inviteIds,
                outcome: 'success',
                blockers: [],
            }),
            executionReceipt: supportInviteAssistExecutionReceipt({
                actorId: actorId,
                organizationId: organization.id,
                requestId,
                reason,
                controls: controls,
                input: inviteInput,
                invites: rows,
                inviteIds,
                outcome: 'success',
                auditEventIds,
                blockers: [],
            }),
            scope: {
                organizationId: organization.id,
                inviteIds,
                role: inviteInput.role,
                expiresAt: inviteInput.expiresAt,
                supportScope: controls.scope,
            },
            outcome: 'success',
            idempotencyKey: controls.idempotencyKey,
            correlationId: controls.correlationId,
            auditEventIds,
            noSilentMembershipMutation: true,
            audit: {
                actionType: 'support.organization.invite_assist',
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: 'notice',
                eventIds: auditEventIds,
                query: supportInviteAssistAuditQuery({
                    requestId,
                    organizationId: organization.id,
                    entityId,
                    correlationId: controls.correlationId,
                    idempotencyKey: controls.idempotencyKey,
                    reason,
                }),
            },
            copyText: [
                `Support invite assistance for ${rows.map(row => row.email).join(', ')}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${inviteInput.role}`,
                `Expires: ${inviteInput.expiresAt}`,
                `Request: ${requestId}`,
                `Idempotency: ${controls.idempotencyKey}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}
