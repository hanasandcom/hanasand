import type { FastifyRequest } from 'fastify'
import run from '#db'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'

const MAX_ACTIVE_AUTOMATIONS = 10

export async function canManageAllAutomations(req: FastifyRequest) {
    const access = await hasHanasandInternalRouteAccess(req)
    return access.valid
}

export async function activeAutomationLimitError(ownerId: string, excludeId?: string) {
    const result = await run(`
        SELECT COUNT(*)::INT AS active_count
        FROM agent_automations
        WHERE owner_id = $1
          AND status = 'active'
          AND ($2::TEXT IS NULL OR id <> $2)
    `, [ownerId, excludeId || null])

    const count = Number(result.rows[0]?.active_count || 0)
    if (count >= MAX_ACTIVE_AUTOMATIONS) {
        return `You can have up to ${MAX_ACTIVE_AUTOMATIONS} active automations. Pause or delete one before activating another.`
    }

    return null
}
