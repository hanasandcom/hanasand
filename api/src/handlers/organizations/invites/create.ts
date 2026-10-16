import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import { touchOrganization, upsertOrganizationInvite } from '#utils/db/identityDataWrites.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import {
    normalizeInviteInput,
    organizationInviteAcceptanceReference,
    roleCanManageOrganization,
    toInvite,
    type OrganizationInviteRow,
    type InviteInput,
    type OrganizationRole,
} from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { inactiveOrganizationMutationBlocker, sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'
import { loadInviteForEmail, loadInviteRecipientState, sendInviteManagementDenial } from './shared.ts'

type OrganizationParams = { id: string }

type BulkInviteResult = {
    email: string
    role: OrganizationRole
    outcome: 'invited' | 'updated_pending_invite' | 'already_member' | 'blocked_removed_member' | 'blocked_deactivated_user'
    inviteId?: string
    acceptanceToken?: string
    acceptancePath?: string
    userId?: string
    memberRole?: OrganizationRole
    reason?: string
}

export async function postOrganizationInvites(req: FastifyRequest<{ Params: OrganizationParams, Body: InviteInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    if (!roleCanManageOrganization(organization.role)) {
        return sendInviteManagementDenial(req, res, organization, userId, {
            action: 'create_invite',
            requestId: typeof req.body?.requestId === 'string' ? req.body.requestId : typeof req.body?.request_id === 'string' ? req.body.request_id : null,
            message: 'Only organization owners and admins can invite members.',
        })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'invite members')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input: ReturnType<typeof normalizeInviteInput>
    try {
        input = normalizeInviteInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid invites.' })
    }

    const requestId = input.requestId || randomUUID()
    const rows: OrganizationInviteRow[] = []
    const results: BulkInviteResult[] = []
    for (const email of input.emails) {
        const recipient = await loadInviteRecipientState(req.params.id, email)
        if (recipient?.user_active === false) {
            results.push({
                email,
                role: input.role,
                outcome: 'blocked_deactivated_user',
                userId: recipient.user_id,
                reason: 'Recipient account is deactivated.',
            })
            continue
        }

        if (recipient?.member_status === 'active') {
            results.push({
                email,
                role: input.role,
                outcome: 'already_member',
                userId: recipient.user_id,
                memberRole: recipient.member_role ?? undefined,
                reason: 'Recipient is already an active organization member.',
            })
            continue
        }

        if (recipient?.member_status === 'removed') {
            results.push({
                email,
                role: input.role,
                outcome: 'blocked_removed_member',
                userId: recipient.user_id,
                memberRole: recipient.member_role ?? undefined,
                reason: 'Recipient was removed from this organization.',
            })
            continue
        }

        const existingInvite = await loadInviteForEmail(req.params.id, email)
        const inviteRow = await upsertOrganizationInvite({
            id: randomUUID(), organizationId: req.params.id, email,
            role: input.role, invitedBy: userId, expiresAt: input.expiresAt,
        }) as OrganizationInviteRow
        rows.push(inviteRow)
        results.push({
            email,
            role: input.role,
            outcome: existingInvite && existingInvite.status === 'pending' && Date.parse(existingInvite.expires_at) > Date.now()
                ? 'updated_pending_invite'
                : 'invited',
            inviteId: inviteRow.id,
            ...organizationInviteAcceptanceReference(inviteRow.id),
        })
    }

    if (rows.length > 0) {
        await touchOrganization(req.params.id)
    }
    logOrganizationEvent(req, 'organization_invites_created', req.params.id, userId, {
        requestId,
        inviteCount: rows.length,
        submittedRecipientCount: input.submittedRecipientCount,
        recipientCount: results.length,
        duplicateRecipientCount: input.duplicateRecipientCount,
        skippedCount: results.length - rows.length,
        outcomes: results.reduce<Record<string, number>>((acc, result) => {
            acc[result.outcome] = (acc[result.outcome] ?? 0) + 1
            return acc
        }, {}),
        role: input.role,
        expiresAt: input.expiresAt,
    })
    await recordSystemEvent(req, {
        actionType: 'organization.membership.invites_created',
        actorId: userId,
        organizationId: req.params.id,
        targetType: 'organization_invites',
        targetId: requestId,
        entityId: req.params.id,
        context: { inviteIds: rows.map(invite => invite.id), role: input.role, inviteCount: rows.length },
    })
    return res.status(201).send({
        requestId,
        actorId: userId,
        organizationId: req.params.id,
        invites: rows.map(toInvite),
        workflow: {
            schemaVersion: 'organization.bulk_invite.v1',
            requestId,
            organizationId: req.params.id,
            actorId: userId,
            role: input.role,
            expiresAt: input.expiresAt,
            submittedRecipientCount: input.submittedRecipientCount,
            recipientCount: results.length,
            normalizedRecipientCount: input.normalizedRecipientCount,
            duplicateRecipientCount: input.duplicateRecipientCount,
            invitedCount: rows.length,
            skippedCount: results.length - rows.length,
            duplicateInviteCount: results.filter(result => result.outcome === 'updated_pending_invite').length,
            results,
        },
    })
}
