import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { touchOrganization } from '#utils/db/identityDataWrites.ts'
import {
    normalizeWatchlistCleanupInput,
    normalizeWatchlistRequestId,
    roleCanManageOrganization,
    toWatchlistItem,
    type OrganizationWatchlistRow,
    type WatchlistCleanupInput,
} from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { sendWatchlistMutationDenial } from './mutationDenial.ts'
import { privacyDeletionMutationBlocker, sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'

type OrganizationParams = { id: string }

export async function postOrganizationWatchlistCleanup(req: FastifyRequest<{ Params: OrganizationParams, Body: WatchlistCleanupInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const deletionBlocker = privacyDeletionMutationBlocker(organization, 'clean up shared watchlists')
    if (deletionBlocker) return sendOrganizationLifecycleBlocker(req, res, deletionBlocker, userId, organization.role)

    if (!roleCanManageOrganization(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'cleanup_watchlists',
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can clean up watchlists.',
        })
    }

    let input: ReturnType<typeof normalizeWatchlistCleanupInput>
    try {
        input = normalizeWatchlistCleanupInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist cleanup.' })
    }

    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = 'archived',
            archived_at = COALESCE(archived_at, NOW()),
            updated_by = $3,
            lifecycle_reason = $4,
            lifecycle_request_id = $5,
            updated_at = NOW()
        WHERE organization_id = $1
          AND id = ANY($2::text[])
          AND archived_at IS NULL
        RETURNING *
    `, [req.params.id, input.itemIds, userId, input.reason ?? null, input.requestId ?? null])
    const archivedItems = result.rows as OrganizationWatchlistRow[]
    const archivedIds = new Set(archivedItems.map(item => item.id))
    const skippedItemIds = input.itemIds.filter(itemId => !archivedIds.has(itemId))

    if (archivedItems.length > 0) {
        await touchOrganization(req.params.id)
    }

    const serviceLogAction = 'organization_watchlist_cleanup_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        reason: input.reason,
        requestedItemIds: input.itemIds,
        archivedItemIds: archivedItems.map(item => item.id),
        skippedItemIds,
        archivedCount: archivedItems.length,
    })

    return res.send({
        cleanup: {
            schemaVersion: 'organization.watchlist_cleanup.v1',
            organizationId: req.params.id,
            tenantId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            requestId: input.requestId ?? null,
            reason: input.reason ?? null,
            requestedItemIds: input.itemIds,
            archivedItemIds: archivedItems.map(item => item.id),
            skippedItemIds,
            archivedCount: archivedItems.length,
            serviceLogAction,
        },
        archivedItems: archivedItems.map(toWatchlistItem),
    })
}
