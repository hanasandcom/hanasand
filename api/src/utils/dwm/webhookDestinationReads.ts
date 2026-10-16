import run from '#db'
import type { DwmWebhookDestinationRow } from './webhookDestinationTypes.ts'
import { toDwmWebhookDestination } from './webhookDestinationModels.ts'

export async function listDwmWebhookDestinations(ownerId: string, orgId?: string) {
    if (orgId && orgId !== ownerId) {
        const result = await run(`
            SELECT *
            FROM dwm_webhook_destinations
            WHERE org_id = $1
              AND status <> 'archived'
            ORDER BY updated_at DESC, created_at DESC
        `, [orgId])

        return (result.rows as DwmWebhookDestinationRow[]).map(toDwmWebhookDestination)
    }

    const result = await run(`
        SELECT *
        FROM dwm_webhook_destinations
        WHERE owner_id = $1
          AND status <> 'archived'
          AND ($2::TEXT IS NULL OR org_id = $2)
        ORDER BY updated_at DESC, created_at DESC
    `, [ownerId, orgId || null])

    return (result.rows as DwmWebhookDestinationRow[]).map(toDwmWebhookDestination)
}

export async function loadDwmWebhookDestination(ownerId: string, id: string) {
    const result = await run(`
        SELECT *
        FROM dwm_webhook_destinations
        WHERE id = $1
          AND (
              owner_id = $2
              OR org_id IN (
                  SELECT organization_id
                  FROM organization_members
                  WHERE user_id = $2
                    AND status = 'active'
              )
          )
    `, [id, ownerId])

    return (result.rows as DwmWebhookDestinationRow[])[0] || null
}

export async function loadDestinationsForOrg(ownerId: string, orgId: string) {
    if (orgId !== ownerId) {
        const result = await run(`
            SELECT *
            FROM dwm_webhook_destinations
            WHERE org_id = $1
              AND status <> 'archived'
            ORDER BY created_at ASC
        `, [orgId])

        return result.rows as DwmWebhookDestinationRow[]
    }

    const result = await run(`
        SELECT *
        FROM dwm_webhook_destinations
        WHERE owner_id = $1
          AND org_id = $2
          AND status <> 'archived'
        ORDER BY created_at ASC
    `, [ownerId, orgId])

    return result.rows as DwmWebhookDestinationRow[]
}
