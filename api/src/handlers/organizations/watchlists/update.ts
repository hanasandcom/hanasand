import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { touchOrganization } from '#utils/db/identityDataWrites.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { normalizeWatchlistInput, normalizeWatchlistRequestId, roleCanWriteWatchlist, toWatchlistItem, type WatchlistInput, type OrganizationWatchlistRow } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { sendWatchlistLookupDenial } from './lookupDenial.ts'
import { sendWatchlistMutationDenial } from './mutationDenial.ts'
import { organizationWatchlistOperation } from './operation.ts'
import { inactiveOrganizationMutationBlocker, sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'
import type { WatchlistParams } from './mutationTypes.ts'

export async function putOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.organizationId)
    if (!requestContext) return
    const { userId, organization } = requestContext

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'update_watchlist',
            itemId: req.params.itemId,
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners, admins, and editors can update watchlists.',
        })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'update shared watchlists')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input: ReturnType<typeof normalizeWatchlistInput>
    try {
        input = normalizeWatchlistInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist item.' })
    }

    const result = await run(`
        UPDATE organization_watchlist_items
        SET kind = $3,
            value = $4,
            notes = $5,
            updated_by = $6,
            lifecycle_reason = $7,
            lifecycle_request_id = $8,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND archived_at IS NULL
          AND status <> 'archived'
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, input.kind, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: 'update_watchlist',
            itemId: req.params.itemId,
            requestId: input.requestId,
            reason: input.reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = 'organization_watchlist_updated'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId: input.requestId,
        watchlistItemId: req.params.itemId,
        kind: input.kind,
        value: input.value,
        reason: input.reason,
    })
    await recordSystemEvent(req, {
        actionType: 'watchlist.updated',
        actorId: userId,
        source: 'organization',
        targetType: 'watchlist_item',
        targetId: req.params.itemId,
        organizationId: req.params.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        context: { kind: input.kind, status: result.rows[0]?.status },
    })
    return res.send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: 'updated',
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId: input.requestId,
            serviceLogAction,
        }),
    })
}
