import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { constantTimeEqual } from '#utils/dwm/webhooks.ts'
import { configurationPermissionError } from './webhookRouteOrganizations.ts'

export async function authenticatedUserId(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    return id
}

export function serviceTokenMatches(value: string | string[] | undefined) {
    const expected = process.env.TI_SCRAPER_SERVICE_TOKEN || ''
    const presented = Array.isArray(value) ? value[0] || '' : value || ''
    return constantTimeEqual(expected, presented)
}

export async function updatePreview(destinationId: string, userId: string) {
    const destinations = await run(`
        SELECT id, org_id
        FROM dwm_webhook_destinations
        WHERE id = $1
          AND status <> 'archived'
          AND (
              owner_id = $2
              OR org_id IN (
                  SELECT organization_id
                  FROM organization_members
                  WHERE user_id = $2
                    AND status = 'active'
              )
          )
        LIMIT 1
    `, [destinationId, userId])

    const row = destinations.rows[0] as { id: string, org_id: string } | undefined
    return row ? { id: row.id, orgId: row.org_id } : null
}

export async function sendConfigurationPermissionError(res: FastifyReply, orgId: string, userId: string) {
    const permissionError = await configurationPermissionError(orgId, userId)
    if (!permissionError) return false
    res.status(permissionError.status).send({ error: permissionError.message })
    return true
}
