import type { FastifyReply, FastifyRequest } from 'fastify'
import { organizationWatchlistMutationDenial, type OrganizationRow } from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'

export function sendWatchlistMutationDenial(
    req: FastifyRequest,
    res: FastifyReply,
    organization: OrganizationRow,
    actorId: string,
    input: {
        action: 'create_watchlist' | 'update_watchlist' | 'archive_watchlist' | 'watchlist_lifecycle_action' | 'cleanup_watchlists'
        itemId?: string | null
        requestId?: string | null
        reason?: string | null
        message: string
    }
) {
    const denial = organizationWatchlistMutationDenial({
        organizationId: organization.id,
        actorId,
        actorRole: organization.role,
        ...input,
    })
    logOrganizationEvent(req, denial.serviceLogAction, organization.id, actorId, {
        requestId: denial.requestId,
        reason: denial.reason,
        action: denial.action,
        itemId: denial.itemId,
        actorRole: organization.role,
        denialReason: denial.denialReason,
    })
    return res.status(403).send({ error: input.message, watchlistMutationDenial: denial })
}
