import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { touchOrganization } from '#utils/db/identityDataWrites.ts'
import { activeOrganizationOwnerCount } from '#utils/organizationMemberships.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { normalizeOwnershipTransferInput, toMember, toOrganization, type OrganizationMemberRow, type OrganizationOwnershipTransferInput } from '#utils/organizations.ts'
import { logOrganizationEvent } from './audit.ts'
import { inactiveOrganizationMutationBlocker, sendOrganizationLifecycleBlocker } from './lifecycle.ts'
import { lockOrganizationMemberMutationScope } from './memberMutationContext.ts'
import { loadOrganizationForMember, loadOrganizationMembership, loadRequiredOrganizationMemberRequest } from './requestContext.ts'

type OrganizationParams = { id: string }

export async function postOrganizationOwnershipTransfer(req: FastifyRequest<{ Params: OrganizationParams, Body: OrganizationOwnershipTransferInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    if (organization.role !== 'owner') {
        return res.status(403).send({ error: 'Only organization owners can transfer ownership.' })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'transfer ownership')
    if (lifecycleBlocker) return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)

    let input: ReturnType<typeof normalizeOwnershipTransferInput>
    try {
        input = normalizeOwnershipTransferInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid ownership transfer.' })
    }
    if (input.targetUserId === userId) return res.status(400).send({ error: 'Choose another active member as the new owner.' })

    const target = await loadOrganizationMembership(req.params.id, input.targetUserId)
    if (!target || target.status !== 'active') return res.status(404).send({ error: 'Target member not found.' })

    const transferOutcome = await withTransaction(async query => {
        await lockOrganizationMemberMutationScope(query, req.params.id, [userId, input.targetUserId])
        const lockedOrganization = await loadOrganizationForMember(req.params.id, userId, query)
        if (!lockedOrganization) return { error: 'organization_not_found' as const }
        if (lockedOrganization.role !== 'owner') return { error: 'organization_role_forbidden' as const, organization: lockedOrganization }
        const lockedLifecycleBlocker = inactiveOrganizationMutationBlocker(lockedOrganization, 'transfer ownership')
        if (lockedLifecycleBlocker) return { error: 'organization_inactive' as const, organization: lockedOrganization, lifecycleBlocker: lockedLifecycleBlocker }

        const lockedTargetOrganization = await loadOrganizationForMember(req.params.id, input.targetUserId, query)
        if (!lockedTargetOrganization) return { error: 'member_not_found' as const, organization: lockedOrganization }
        const lockedTarget = await loadOrganizationMembership(req.params.id, input.targetUserId, query)
        if (!lockedTarget || lockedTarget.status !== 'active') return { error: 'member_not_found' as const, organization: lockedOrganization }
        const ownerCount = await activeOrganizationOwnerCount(req.params.id, query)

        const result = await query(`
            UPDATE organization_members
            SET role = 'owner'
            WHERE organization_id = $1
              AND user_id = $2
              AND status = 'active'
            RETURNING *
        `, [req.params.id, input.targetUserId])
        if (!result.rows.length) throw new Error('Ownership transfer promotion failed after locked membership validation.')
        const demoted = await query(`
            UPDATE organization_members
            SET role = 'admin'
            WHERE organization_id = $1
              AND user_id = $2
              AND status = 'active'
              AND role = 'owner'
            RETURNING user_id
        `, [req.params.id, userId])
        if (!demoted.rows.length) throw new Error('Ownership transfer demotion failed after locked owner validation.')
        await touchOrganization(req.params.id, query)
        return { error: null, organization: lockedOrganization, target: lockedTarget, ownerCount, result }
    })
    if (transferOutcome.error === 'organization_not_found' || transferOutcome.error === 'member_not_found') {
        return res.status(404).send({ error: transferOutcome.error === 'organization_not_found' ? 'Organization not found.' : 'Target member not found.' })
    }
    if (transferOutcome.error === 'organization_role_forbidden') return res.status(403).send({ error: 'Only organization owners can transfer ownership.' })
    if (transferOutcome.error === 'organization_inactive') {
        return sendOrganizationLifecycleBlocker(req, res, transferOutcome.lifecycleBlocker, userId, transferOutcome.organization.role)
    }
    const { target: authorizedTarget, ownerCount, result } = transferOutcome

    logOrganizationEvent(req, 'organization_ownership_transferred', req.params.id, userId, {
        targetUserId: input.targetUserId,
        previousTargetRole: authorizedTarget.role,
        previousOwnerCount: ownerCount,
        reason: input.reason,
    })
    await recordSystemEvent(req, {
        actionType: 'organization.ownership.transferred',
        actorId: userId,
        organizationId: req.params.id,
        targetType: 'organization_member',
        targetId: input.targetUserId,
        entityId: req.params.id,
        context: { previousOwnerId: userId, previousTargetRole: authorizedTarget.role, reason: input.reason },
    })

    const updated = await loadOrganizationForMember(req.params.id, userId)
    return res.send({
        organization: updated ? toOrganization(updated) : null,
        transfer: { organizationId: req.params.id, previousOwnerId: userId, newOwnerId: input.targetUserId, reason: input.reason },
        member: toMember(result.rows[0] as OrganizationMemberRow),
    })
}
