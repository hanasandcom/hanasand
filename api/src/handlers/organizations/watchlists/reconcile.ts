import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { roleCanWriteWatchlist } from '#utils/organizations.ts'
import { normalizeWatchlistMutationMetadata } from '#utils/organizations/normalization/requestValues.ts'
import { isWatchlistProjectionId, syncWatchlistProjection } from '#utils/organizations/watchlistSync.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { logOrganizationEvent } from '../audit.ts'
import { inactiveOrganizationMutationBlocker, privacyDeletionMutationBlocker, sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'

type Params = { id: string }

export async function postOrganizationWatchlistReconcile(req: FastifyRequest<{ Params: Params, Body: unknown }>, res: FastifyReply) {
    const context = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!context) return
    const { userId, organization } = context
    if (!roleCanWriteWatchlist(organization.role)) {
        logOrganizationEvent(req, 'organization_watchlist_projection_retry_denied', organization.id, userId, { actorRole: organization.role })
        return res.status(403).send({ error: 'Only organization owners, admins, and editors can retry watchlist synchronization.' })
    }
    const blocker = privacyDeletionMutationBlocker(organization, 'retry watchlist synchronization')
        || inactiveOrganizationMutationBlocker(organization, 'retry watchlist synchronization')
    if (blocker) return sendOrganizationLifecycleBlocker(req, res, blocker, userId, organization.role)

    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || !isWatchlistProjectionId(req.params.id)) {
        return res.status(400).send({ error: 'Provide between 1 and 50 watchlist item IDs.' })
    }
    const input = body as Record<string, unknown>
    const fields = ['itemIds', 'item_ids', 'reason', 'requestId', 'request_id', 'organizationId', 'orgId', 'tenantId']
    if (Object.keys(input).some(field => !fields.includes(field))) return res.status(400).send({ error: 'Unsupported watchlist synchronization input.' })
    const ids = input.itemIds ?? input.item_ids
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || new Set(ids).size !== ids.length
        || ids.some(id => typeof id !== 'string' || !isWatchlistProjectionId(id))
        || input.itemIds !== undefined && input.item_ids !== undefined) {
        return res.status(400).send({ error: 'Provide between 1 and 50 different valid watchlist item IDs.' })
    }
    for (const name of ['organizationId', 'orgId', 'tenantId']) {
        const query = (req.query as Record<string, unknown>)[name]
        if (input[name] !== undefined && input[name] !== organization.id || query !== undefined && query !== organization.id) {
            return res.status(400).send({ error: 'Watchlist synchronization scope does not match this organization.' })
        }
    }
    for (const name of ['x-organization-id', 'x-tenant-id']) {
        if (req.headers[name] !== undefined && req.headers[name] !== organization.id) return res.status(400).send({ error: 'Watchlist synchronization scope does not match this organization.' })
    }
    const itemIds = ids as string[]
    const selected = await run(`
        SELECT id FROM organization_watchlist_items
        WHERE organization_id = $1 AND id = ANY($2::text[])
    `, [organization.id, itemIds])
    const ownIds = new Set(selected.rows.map((row: { id: string }) => row.id))
    if (itemIds.some(id => !ownIds.has(id))) return res.status(404).send({ error: 'Selected watchlist items were not found in this organization.' })
    const { reason, requestId } = normalizeWatchlistMutationMetadata(input)
    // Persist the real user's explicit attempt before the service-owned child call.
    // This command never writes source rows or starts event rebuilding.
    await recordSystemEvent(req, {
        actionType: 'watchlist.projection_retry_requested', actorId: userId, source: 'organization',
        targetType: 'organization', targetId: organization.id, organizationId: organization.id,
        requestId, reason, context: { itemIds, actorRole: organization.role, alertRebuild: 'not_requested' },
    })
    const dwmAlertBridge = await syncWatchlistProjection(organization.id, itemIds)
    logOrganizationEvent(req, 'organization_watchlist_projection_retry_result', organization.id, userId, {
        requestId, reason, itemIds, projectionStatus: dwmAlertBridge.projection.status,
    })
    return res.send({ organizationId: organization.id, itemIds, dwmAlertBridge })
}
