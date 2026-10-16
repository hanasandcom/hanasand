import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { updateActiveOrganizationMemberRole } from '#utils/db/identityDataWrites.ts'
import { activeOrganizationOwnerCount as activeOwnerCount } from '#utils/organizationMemberships.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import {
    normalizeMemberRoleInput,
    organizationMemberMutationDenial,
    toMember,
    toOrganization,
    type OrganizationMemberRoleInput,
    type OrganizationMemberRow,
} from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadActiveOrganizationMemberMutationRequest, loadLockedOrganizationMemberMutationContext } from '../memberMutationContext.ts'
import { loadOrganizationForMember } from '../requestContext.ts'
import { buildOrganizationMemberRoleChangeReceipt } from './roleReceipt.ts'
import { roleUpdatePermissionError } from './permissions.ts'
import { sendOrganizationLastOwnerGuard } from './denials.ts'

type OrganizationMemberParams = { id: string; userId: string }

export async function patchOrganizationMemberRole(req: FastifyRequest<{ Params: OrganizationMemberParams, Body: OrganizationMemberRoleInput }>, res: FastifyReply) {
    const mutationContext = await loadActiveOrganizationMemberMutationRequest(req, res, 'change member roles')
    if (!mutationContext) return
    const { userId, organization, target } = mutationContext

    let input: ReturnType<typeof normalizeMemberRoleInput>
    try {
        input = normalizeMemberRoleInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid member role update.' })
    }

    const permissionError = roleUpdatePermissionError(organization.role, target.role, input.role)
    if (permissionError) {
        const denial = organizationMemberMutationDenial({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            targetUserId: req.params.userId,
            targetRole: target.role,
            action: 'change_member_role',
            requestedRole: input.role,
            reason: input.reason,
            requestId: input.requestId,
            message: permissionError,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            targetUserId: req.params.userId,
            targetRole: target.role,
            actorRole: organization.role,
            action: denial.action,
            requestedRole: input.role,
            denialReason: denial.denialReason,
            reason: input.reason,
        })
        return res.status(403).send({ error: permissionError, memberMutationDenial: denial })
    }

    const mutation = await withTransaction(async query => {
        const lockedContext = await loadLockedOrganizationMemberMutationContext({
            query,
            organizationId: req.params.id,
            actorId: userId,
            targetUserId: req.params.userId,
            action: 'change member roles',
        })
        if (lockedContext.error) return lockedContext
        const { organization: lockedOrganization, target: lockedTarget } = lockedContext
        const lockedPermissionError = roleUpdatePermissionError(lockedOrganization.role, lockedTarget.role, input.role)
        if (lockedPermissionError) return { error: 'organization_role_forbidden' as const, organization: lockedOrganization, target: lockedTarget, permissionError: lockedPermissionError }

        const ownerCount = await activeOwnerCount(req.params.id, query)
        if (lockedTarget.role === 'owner' && input.role !== 'owner' && ownerCount <= 1) {
            return { error: 'organization_owner_required' as const, organization: lockedOrganization, target: lockedTarget, ownerCount }
        }

        const updatedMember = await updateActiveOrganizationMemberRole({
            organizationId: req.params.id,
            userId: req.params.userId,
            role: input.role,
        }, query)
        if (!updatedMember) return { error: 'member_not_found' as const, organization: lockedOrganization }
        return { error: null, organization: lockedOrganization, target: lockedTarget, ownerCount, updatedMember }
    })

    if (mutation.error === 'organization_not_found' || mutation.error === 'member_not_found') {
        return res.status(404).send({ error: mutation.error === 'organization_not_found' ? 'Organization not found.' : 'Organization member not found.' })
    }
    if (mutation.error === 'organization_inactive') {
        return sendOrganizationLifecycleBlocker(req, res, mutation.lifecycleBlocker, userId, mutation.organization.role)
    }
    if (mutation.error === 'organization_role_forbidden') {
        const denial = organizationMemberMutationDenial({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: mutation.organization.role,
            targetUserId: req.params.userId,
            targetRole: mutation.target.role,
            action: 'change_member_role',
            requestedRole: input.role,
            reason: input.reason,
            requestId: input.requestId,
            message: mutation.permissionError,
        })
        return res.status(403).send({ error: mutation.permissionError, memberMutationDenial: denial })
    }
    if (mutation.error === 'organization_owner_required') {
        return sendOrganizationLastOwnerGuard(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            actorRole: mutation.organization.role,
            targetUserId: req.params.userId,
            action: 'change_owner_role',
            requestedRole: input.role,
            ownerCount: mutation.ownerCount,
            message: 'Transfer ownership before changing the last owner role.',
            requestId: input.requestId,
        }, {
            requestedRole: input.role,
            reason: input.reason,
        })
    }

    const { organization: authorizedOrganization, target: authorizedTarget, updatedMember } = mutation
    const serviceLogAction = 'organization_member_role_updated'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        targetUserId: req.params.userId,
        previousRole: authorizedTarget.role,
        newRole: input.role,
        actorRole: authorizedOrganization.role,
        reason: input.reason,
    })
    await recordSystemEvent(req, {
        actionType: 'organization.membership.role_updated',
        actorId: userId,
        organizationId: req.params.id,
        targetType: 'organization_member',
        targetId: req.params.userId,
        entityId: req.params.id,
        context: {
            previousRole: authorizedTarget.role,
            newRole: input.role,
            reason: input.reason,
            requestId: input.requestId,
        },
    })
    const updated = await loadOrganizationForMember(req.params.id, userId)
    return res.send({
        organization: updated ? toOrganization(updated) : null,
        member: toMember(updatedMember as OrganizationMemberRow),
        roleChange: buildOrganizationMemberRoleChangeReceipt({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: authorizedOrganization.role,
            targetUserId: req.params.userId,
            previousRole: authorizedTarget.role,
            newRole: input.role,
            reason: input.reason,
            requestId: input.requestId,
            serviceLogAction,
        }),
    })
}
