import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { ensureEventProtectionRule } from '#utils/db/analysisPolicySchema.ts'
import { withTransaction } from '#db'
import { normalizeOrganizationInput, organizationLifecycleReadiness, toOrganization, type OrganizationInput, type OrganizationRow } from '#utils/organizations.ts'
import { logOrganizationEvent, sendOrganizationAccessDenial } from './audit.ts'
import { authenticateOrganizationRequest, loadOrganizationMemberRequest, uniqueOrganizationSlug } from './requestContext.ts'

type OrganizationParams = { id: string }

export async function postOrganization(req: FastifyRequest<{ Body: OrganizationInput }>, res: FastifyReply) {
    const userId = await authenticateOrganizationRequest(req, res)
    if (!userId) return

    let input: ReturnType<typeof normalizeOrganizationInput>
    try {
        input = normalizeOrganizationInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid organization.' })
    }

    const organizationId = randomUUID()
    const slug = await uniqueOrganizationSlug(input.slug)
    const organization = await withTransaction(async query => {
        const created = await query(`
        WITH new_organization AS (
            INSERT INTO organizations (id, name, slug, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        ),
        owner_membership AS (
            INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
            SELECT id, $4, 'owner', 'active', $4
            FROM new_organization
            RETURNING organization_id
        )
        SELECT new_organization.*
        FROM new_organization
        JOIN owner_membership ON owner_membership.organization_id = new_organization.id
    `, [organizationId, input.name, slug, userId])
        await ensureEventProtectionRule(query, organizationId)
        return created
    })
    logOrganizationEvent(req, 'organization_created', organizationId, userId, { name: input.name, slug })

    const createdOrganization: OrganizationRow = {
        ...(organization.rows[0] as OrganizationRow),
        role: 'owner',
        member_count: 1,
        owner_count: 1,
        admin_count: 1,
        pending_invite_count: 0,
    }
    return res.status(201).send({
        organization: toOrganization(createdOrganization),
        lifecycleReadiness: organizationLifecycleReadiness(createdOrganization),
    })
}

export async function getOrganization(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) {
        return sendOrganizationAccessDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id',
        })
    }

    return res.send({
        organization: toOrganization(organization),
        lifecycleReadiness: organizationLifecycleReadiness(organization),
    })
}
