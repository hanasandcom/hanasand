import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { activeOrganizationOwnerCount } from '#utils/organizationMemberships.ts'
import { createApiKey, listOrganizationApiKeys, organizationPublicApiScopes, revokeOrganizationApiKey } from '#utils/auth/apiKeys.ts'
import { roleCanManageOrganization } from '#utils/organizations.ts'
import { logOrganizationEvent } from './audit.ts'
import { loadOrganizationForMember, loadOrganizationMemberRequest } from './requestContext.ts'

type OrganizationParams = { id: string }
type OrganizationApiKeyParams = OrganizationParams & { keyId: string }

export async function getOrganizationApiKeys(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id, {
        error: { code: 'authentication_required', message: 'Sign in to manage organization API keys.' },
    })
    if (!requestContext) return
    const { organization } = requestContext
    if (!organization) return res.status(404).send({ error: { code: 'organization_not_found', message: 'Organization not found.' } })
    if (!roleCanManageOrganization(organization.role)) return res.status(403).send({ error: { code: 'organization_role_forbidden', message: 'Organization owners and administrators manage API keys.' } })

    return res.send({
        organizationId: organization.id,
        apiKeys: await listOrganizationApiKeys(organization.id),
    })
}

export async function postOrganizationApiKey(req: FastifyRequest<{ Params: OrganizationParams, Body: { name?: unknown } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id, {
        error: { code: 'authentication_required', message: 'Sign in to create an organization API key.' },
    })
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) return res.status(404).send({ error: { code: 'organization_not_found', message: 'Organization not found.' } })
    if (!roleCanManageOrganization(organization.role)) return res.status(403).send({ error: { code: 'organization_role_forbidden', message: 'Organization owners and administrators manage API keys.' } })
    if (organization.status !== 'active') return res.status(409).send({ error: { code: 'organization_inactive', message: 'Reactivate the organization before creating an API key.' } })
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => key !== 'name')) {
        return res.status(400).send({ error: { code: 'invalid_request', message: 'API key creation accepts only the name field.' } })
    }
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    if (name.length < 2 || name.length > 80) return res.status(400).send({ error: { code: 'invalid_api_key_name', message: 'API key name must contain 2-80 characters.' } })

    try {
        const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString()
        const creation = await withTransaction(async query => {
            await query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [organization.id])
            const lockedOrganization = await loadOrganizationForMember(organization.id, userId, query)
            if (!lockedOrganization) return { error: 'organization_not_found' as const }
            if (!roleCanManageOrganization(lockedOrganization.role)) return { error: 'organization_role_forbidden' as const }
            if (lockedOrganization.status !== 'active') return { error: 'organization_inactive' as const }
            if (await activeOrganizationOwnerCount(organization.id, query) < 1) return { error: 'organization_owner_required' as const }
            return {
                created: await createApiKey({
                    ownerId: userId,
                    organizationId: organization.id,
                    name,
                    tier: 'starter',
                    description: `Organization API access for ${organization.name}.`,
                    enabled: true,
                    expiresAt,
                    scopes: organizationPublicApiScopes(),
                }, query),
            }
        })
        if ('error' in creation) {
            if (creation.error === 'organization_not_found') return res.status(404).send({ error: { code: creation.error, message: 'Organization not found.' } })
            if (creation.error === 'organization_role_forbidden') return res.status(403).send({ error: { code: creation.error, message: 'Organization owners and administrators manage API keys.' } })
            if (creation.error === 'organization_inactive') return res.status(409).send({ error: { code: creation.error, message: 'Reactivate the organization before creating an API key.' } })
            if (creation.error === 'organization_owner_required') return res.status(409).send({ error: { code: creation.error, message: 'Add or transfer ownership to an active member before creating an API key.' } })
        }
        const { created } = creation
        logOrganizationEvent(req, 'organization_api_key_created', organization.id, userId, {
            apiKeyId: created.apiKey.id,
            keyPrefix: created.apiKey.keyPrefix,
            expiresAt,
        })
        return res.status(201).send(created)
    } catch (error) {
        if ((error as { code?: string }).code === '23505') return res.status(409).send({ error: { code: 'api_key_conflict', message: 'The API key could not be generated. Try again.' } })
        req.log.error({ error, organizationId: organization.id }, 'Failed to create organization API key')
        return res.status(500).send({ error: { code: 'api_key_create_failed', message: 'The API key could not be created.' } })
    }
}

export async function deleteOrganizationApiKey(req: FastifyRequest<{ Params: OrganizationApiKeyParams }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id, {
        error: { code: 'authentication_required', message: 'Sign in to revoke an organization API key.' },
    })
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) return res.status(404).send({ error: { code: 'organization_not_found', message: 'Organization not found.' } })
    if (!roleCanManageOrganization(organization.role)) return res.status(403).send({ error: { code: 'organization_role_forbidden', message: 'Organization owners and administrators manage API keys.' } })

    const apiKey = await revokeOrganizationApiKey(organization.id, req.params.keyId)
    if (!apiKey) return res.status(404).send({ error: { code: 'api_key_not_found', message: 'Active organization API key not found.' } })
    logOrganizationEvent(req, 'organization_api_key_revoked', organization.id, userId, {
        apiKeyId: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
    })
    return res.send({ apiKey })
}
