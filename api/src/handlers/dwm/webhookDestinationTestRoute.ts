import type { FastifyReply, FastifyRequest } from 'fastify'
import {
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    testDwmWebhookDestination,
    type DwmAlertNotificationInput,
} from '#utils/dwm/webhooks.ts'
import { authenticatedUserId, sendConfigurationPermissionError, updatePreview } from './webhookRouteAuth.ts'
import { loadDestinationCrudPreflight } from './webhookRouteOrganizations.ts'
import { buildDwmWebhookDestinationTestResponse, destinationTestResponseOutcome } from './webhookResponses.ts'
import type { IdParams } from './webhookRouteTypes.ts'

export async function postDwmWebhookDestinationTest(req: FastifyRequest<{ Params: IdParams, Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    if (await sendConfigurationPermissionError(res, existing.orgId, userId)) return

    const input = { ...(req.body || {}), orgId: existing.orgId }
    const preflight = await loadDestinationCrudPreflight(userId, existing.orgId, req.params.id, 'test', input)
    const { destinationCrud: preflightCrud } = preflight
    if (!preflightCrud.canApply) {
        return res.status(400).send({
            error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be tested.',
            destinationCrud: preflightCrud,
        })
    }

    const delivery = await testDwmWebhookDestination(userId, req.params.id, req.body || {})
    if (!delivery) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }
    const destinations = await listDwmWebhookDestinations(userId, existing.orgId)
    const destination = destinations.find(item => item.id === req.params.id)
    const deliveries = await listDwmWebhookDeliveries(userId, existing.orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, existing.orgId)
    const response = buildDwmWebhookDestinationTestResponse({
        delivery,
        ownerId: userId,
        orgId: existing.orgId,
        input: req.body || {},
        destination,
        destinations,
        deliveries,
        auditEvents,
    })
    const outcome = destinationTestResponseOutcome(delivery)
    return res.status(outcome.status).send(outcome.failed ? { ...response, error: outcome.error, code: outcome.code } : response)
}
