import { savedWatchlistProjection } from '#utils/organizations/watchlistSync.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import run from '#db'
import { touchOrganization } from '#utils/db/identityDataWrites.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { checkBillingCapacity } from '../../billing.ts'
import { normalizeWatchlistInput, roleCanWriteWatchlist, toWatchlistItem, type WatchlistInput, type OrganizationWatchlistRow } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { sendWatchlistMutationDenial } from './mutationDenial.ts'
import { watchlistMutationDenialContext } from './denialContext.ts'
import { organizationWatchlistOperation } from './operation.ts'
import { inactiveOrganizationMutationBlocker, sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'
import type { OrganizationParams } from './mutationTypes.ts'

export async function postOrganizationWatchlist(req: FastifyRequest<{ Params: OrganizationParams, Body: WatchlistInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'create_watchlist',
            ...watchlistMutationDenialContext(req.body),
            message: 'Only organization owners, admins, and editors can update watchlists.',
        })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'create shared watchlists')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input: ReturnType<typeof normalizeWatchlistInput>
    try {
        input = normalizeWatchlistInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist item.' })
    }

    const existing = await run(`
        SELECT id
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND kind = $2
          AND lower(value) = lower($3)
          AND archived_at IS NULL
          AND status <> 'archived'
        LIMIT 1
    `, [req.params.id, input.kind, input.value])

    if (!existing.rows[0]) {
        const usage = await run(`
            SELECT COUNT(*)::int AS used
            FROM organization_watchlist_items
            WHERE organization_id IN (
                SELECT organization_id
                FROM organization_members
                WHERE user_id = $1 AND status = 'active'
            )
              AND archived_at IS NULL
              AND status <> 'archived'
        `, [userId])
        const quota = await checkBillingCapacity(userId, 'watchTerms', Number(usage.rows[0]?.used || 0))
        if (!quota.allowed) return res.status(quota.subscriptionRequired ? 402 : 409).send({ error: quota.subscriptionRequired ? 'subscription_required' : 'quota_exhausted', message: quota.subscriptionRequired ? 'A Dark Web Monitoring plan is required to create watch terms.' : 'Your watch-term quota has been reached.', quota })
    }

    const result = existing.rows[0]
        ? await run(`
            UPDATE organization_watchlist_items
            SET value = $3,
                notes = $4,
                status = 'active',
                updated_by = $5,
                lifecycle_reason = $6,
                lifecycle_request_id = $7,
                updated_at = NOW()
            WHERE id = $1
              AND organization_id = $2
            RETURNING *
        `, [existing.rows[0].id, req.params.id, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])
        : await run(`
        INSERT INTO organization_watchlist_items (id, organization_id, kind, value, notes, status, created_by, updated_by, lifecycle_reason, lifecycle_request_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $6, $7, $8, NOW(), NOW())
        RETURNING *
    `, [randomUUID(), req.params.id, input.kind, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])

    await touchOrganization(req.params.id)
    const serviceLogAction = 'organization_watchlist_upserted'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        watchlistItemId: result.rows[0]?.id,
        kind: input.kind,
        value: input.value,
        reason: input.reason,
    })
    await recordSystemEvent(req, {
        actionType: existing.rows[0] ? 'watchlist.updated' : 'watchlist.created',
        actorId: userId,
        source: 'organization',
        targetType: 'watchlist_item',
        targetId: result.rows[0]?.id,
        organizationId: req.params.id,
        requestId: input.requestId,
        reason: input.reason,
        context: { kind: input.kind, status: result.rows[0]?.status },
    })
    return res.status(201).send({
        ...await savedWatchlistProjection(req.params.id, [String(result.rows[0].id)]),
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: existing.rows[0] ? 'updated' : 'created',
            watchlistItemId: result.rows[0]?.id,
            actorId: userId,
            requestId: input.requestId,
            reason: input.reason,
            serviceLogAction,
            existingItemId: existing.rows[0]?.id ?? null,
            duplicateTermMatched: Boolean(existing.rows[0]),
        }),
    })
}
