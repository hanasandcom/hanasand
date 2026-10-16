import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import type { OrganizationRole } from '#utils/organizations.ts'
import { inactiveOrganizationMutationBlocker, sendOrganizationLifecycleBlocker } from './lifecycle.ts'
import { loadOrganizationForMember, loadOrganizationMemberRequest, loadOrganizationMembership } from './requestContext.ts'

type OrganizationMemberParams = { id: string; userId: string }

export async function loadLockedOrganizationMemberMutationContext({
    query,
    organizationId,
    actorId,
    targetUserId,
    action,
}: {
    query: typeof run
    organizationId: string
    actorId: string
    targetUserId: string
    action: string
}) {
    await lockOrganizationMemberMutationScope(query, organizationId, [actorId, targetUserId])
    const organization = await loadOrganizationForMember(organizationId, actorId, query)
    if (!organization) return { error: 'organization_not_found' as const }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, action)
    if (lifecycleBlocker) return { error: 'organization_inactive' as const, organization, lifecycleBlocker }

    const target = await loadOrganizationMembership(organizationId, targetUserId, query)
    if (!target || target.status !== 'active') return { error: 'member_not_found' as const, organization }
    return { error: null, organization, target }
}

export async function lockOrganizationMemberMutationScope(query: typeof run, organizationId: string, userIds: string[]) {
    await query(`
        SELECT id
        FROM users
        WHERE id = ANY($1::text[])
        ORDER BY id
        FOR UPDATE
    `, [[...userIds].sort()])
    await query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [organizationId])
}

export async function loadActiveOrganizationMemberMutationRequest(
    req: FastifyRequest<{ Params: OrganizationMemberParams }>,
    res: FastifyReply,
    action: string,
) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return null
    const { userId, organization } = requestContext
    if (!organization) {
        res.status(404).send({ error: 'Organization not found.' })
        return null
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, action)
    if (lifecycleBlocker) {
        sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role as OrganizationRole | undefined)
        return null
    }

    const target = await loadOrganizationMembership(req.params.id, req.params.userId)
    if (!target || target.status !== 'active') {
        res.status(404).send({ error: 'Organization member not found.' })
        return null
    }
    return { userId, organization, target }
}
