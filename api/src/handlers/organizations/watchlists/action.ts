import { savedWatchlistProjection } from '#utils/organizations/watchlistSync.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { touchOrganization } from '#utils/db/identityDataWrites.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { normalizeWatchlistActionInput, roleCanWriteWatchlist, toWatchlistItem, type WatchlistActionInput, type OrganizationWatchlistRow } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { sendWatchlistLookupDenial } from './lookupDenial.ts'
import { sendWatchlistMutationDenial } from './mutationDenial.ts'
import { watchlistMutationDenialContext } from './denialContext.ts'
import { organizationWatchlistOperation } from './operation.ts'
import { inactiveOrganizationMutationBlocker, privacyDeletionMutationBlocker, sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'
import type { WatchlistParams } from './mutationTypes.ts'

export async function postOrganizationWatchlistAction(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistActionInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.organizationId)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const deletionBlocker = privacyDeletionMutationBlocker(organization, 'change shared watchlists')
    if (deletionBlocker) return sendOrganizationLifecycleBlocker(req, res, deletionBlocker, userId, organization.role)

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'watchlist_lifecycle_action',
            itemId: req.params.itemId,
            ...watchlistMutationDenialContext(req.body),
            message: 'Only organization owners, admins, and editors can update watchlists.',
        })
    }

    let input: ReturnType<typeof normalizeWatchlistActionInput>
    try {
        input = normalizeWatchlistActionInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist action.' })
    }

    const lifecycleBlocker = input.action === 'archive'
        ? null
        : inactiveOrganizationMutationBlocker(organization, `${input.action} shared watchlists`)
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    const nextStatus = input.action === 'resume' || input.action === 'restore' ? 'active' : input.action === 'pause' ? 'paused' : 'archived'
    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = $3,
            archived_at = CASE WHEN $3 = 'archived' THEN NOW() WHEN $7 = 'restore' THEN NULL ELSE archived_at END,
            updated_by = $4,
            lifecycle_reason = $5,
            lifecycle_request_id = $6,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND ($7 = 'restore' OR archived_at IS NULL)
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, nextStatus, userId, input.reason ?? null, input.requestId ?? null, input.action])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: input.action,
            itemId: req.params.itemId,
            requestId: input.requestId,
            reason: input.reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = input.action === 'pause'
        ? 'organization_watchlist_paused'
        : input.action === 'resume'
            ? 'organization_watchlist_resumed'
            : input.action === 'restore'
                ? 'organization_watchlist_restored'
                : 'organization_watchlist_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId: input.requestId,
        reason: input.reason,
        watchlistItemId: req.params.itemId,
        action: input.action,
        status: nextStatus,
    })
    await recordSystemEvent(req, {
        actionType: `watchlist.${input.action === 'pause' ? 'paused' : input.action === 'resume' || input.action === 'restore' ? 'resumed' : 'deleted'}`,
        actorId: userId,
        source: 'organization',
        targetType: 'watchlist_item',
        targetId: req.params.itemId,
        organizationId: req.params.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        context: { action: input.action, status: nextStatus },
    })

    return res.send({
        ...await savedWatchlistProjection(req.params.organizationId, [req.params.itemId]),
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: input.action,
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId: input.requestId,
            reason: input.reason,
            serviceLogAction,
        }),
    })
}
