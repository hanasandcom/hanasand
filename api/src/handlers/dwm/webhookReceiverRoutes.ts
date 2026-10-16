import type { FastifyReply, FastifyRequest } from 'fastify'
import { listDwmWebhookReceiverReceipts, recordDwmWebhookReceiverReceipt } from '#utils/dwm/webhooks.ts'
import { organizationVisibilityDecision } from '#utils/organizations.ts'
import { authenticatedUserId, serviceTokenMatches } from './webhookRouteAuth.ts'
import { loadOrganizationVisibilityMembership, webhookOrganizationVisibilityContext } from './webhookRouteOrganizations.ts'
import { orgIdFromQuery, type OrgQuery } from './webhookRouteTypes.ts'

export async function postDwmWebhookReceiver(req: FastifyRequest<{ Body: unknown }>, res: FastifyReply) {
    if (!serviceTokenMatches(req.headers['x-hanasand-service-token'])) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const result = await recordDwmWebhookReceiverReceipt(req.body)
    if (!result.ok) return res.status(result.status).send({ accepted: false, error: result.error })
    return res.status(result.created ? 201 : 200).send({
        accepted: true,
        created: result.created,
        receipt: result.receipt,
    })
}

export async function getDwmWebhookReceiverReceipts(req: FastifyRequest<{ Querystring: OrgQuery }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = orgIdFromQuery(req.query)
    if (!orgId) return res.status(400).send({ error: 'orgId is required.' })
    const visibility = orgId !== userId ? await loadOrganizationVisibilityMembership(orgId, userId) : null
    const visibilityContext = webhookOrganizationVisibilityContext(orgId, userId, visibility)
    if (orgId !== userId) {
        const decision = organizationVisibilityDecision(visibilityContext || {})
        if (!decision.allowed) {
            return res.status(decision.reason === 'not_member' ? 404 : 403).send({
                error: decision.reason === 'not_member' ? 'Organization not found.' : 'Receiver receipts are not visible for this organization membership.',
                reason: decision.reason,
            })
        }
    }

    const receipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId: req.query.destinationId || req.query.destination_id,
        deliveryId: req.query.deliveryId || req.query.delivery_id,
        reportCaseId: req.query.reportCaseId || req.query.report_case_id,
        reportExportChecksum: req.query.reportExportChecksum || req.query.report_export_checksum,
    })
    return res.send({
        schemaVersion: 'dwm.webhook.receiver_receipts.v1',
        orgId,
        total: receipts.length,
        receipts,
    })
}
