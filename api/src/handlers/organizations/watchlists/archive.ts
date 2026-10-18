import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { touchOrganization } from '#utils/db/identityDataWrites.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { normalizeWatchlistRequestId, roleCanWriteWatchlist, toWatchlistItem, type OrganizationWatchlistRow } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { sendWatchlistLookupDenial } from './lookupDenial.ts'
import { sendWatchlistMutationDenial } from './mutationDenial.ts'
import { watchlistMutationDenialContext } from './denialContext.ts'
import { organizationWatchlistOperation } from './operation.ts'
import { privacyDeletionMutationBlocker, sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'
import type { WatchlistMutationBody, WatchlistParams } from './mutationTypes.ts'

export async function deleteOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistMutationBody, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.organizationId)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const deletionBlocker = privacyDeletionMutationBlocker(organization, 'archive shared watchlists')
    if (deletionBlocker) return sendOrganizationLifecycleBlocker(req, res, deletionBlocker, userId, organization.role)

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'archive_watchlist',
            itemId: req.params.itemId,
            ...watchlistMutationDenialContext(req.body, req.query),
            message: 'Only organization owners, admins, and editors can update watchlists.',
        })
    }

    const requestId = normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id ?? req.query?.requestId ?? req.query?.request_id)
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : undefined

    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = 'archived',
            archived_at = NOW(),
            updated_by = $3,
            lifecycle_reason = $4,
            lifecycle_request_id = $5,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND archived_at IS NULL
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, userId, reason ?? null, requestId ?? null])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: 'archive_watchlist',
            itemId: req.params.itemId,
            requestId,
            reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = 'organization_watchlist_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId,
        reason,
        watchlistItemId: req.params.itemId,
    })
    await recordSystemEvent(req, {
        actionType: 'watchlist.deleted',
        actorId: userId,
        source: 'organization',
        targetType: 'watchlist_item',
        targetId: req.params.itemId,
        organizationId: req.params.organizationId,
        requestId,
        reason,
    })
    return res.send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: 'disabled',
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId,
            reason,
            serviceLogAction,
        }),
    })
}
