import type { FastifyReply, FastifyRequest } from 'fastify'
import { canonicalThirdPartyReportForDelivery } from '#utils/dwm/thirdPartyReportVerification.ts'
import {
    buildDwmWebhookDeliveryRequestInput,
    clean,
    retryDwmWebhookDelivery,
    triggerDwmAlertWebhookNotification,
    type DwmAlertNotificationInput,
} from '#utils/dwm/webhooks.ts'
import { authenticatedUserId, sendConfigurationPermissionError } from './webhookRouteAuth.ts'
import { loadOrganizationName } from './webhookRouteOrganizations.ts'
import { sendDwmWebhookDeliveryResult } from './webhookDeliveryResult.ts'

export async function postDwmWebhookDelivery(req: FastifyRequest<{ Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    let input = buildDwmWebhookDeliveryRequestInput(req.body || {})
    const orgId = clean(input.orgId) || clean(input.organizationId) || clean(input.tenantId) || userId
    if (await sendConfigurationPermissionError(res, orgId, userId)) return

    const retryDeliveryId = clean(req.body?.deliveryId)
    if (retryDeliveryId) {
        const retry = await retryDwmWebhookDelivery(userId, orgId, retryDeliveryId)
        if (!retry.ok) return res.status(retry.status).send({ error: retry.error, code: retry.code, ...('nextRetryAt' in retry ? { nextRetryAt: retry.nextRetryAt } : {}) })
        input = { ...input, alertId: retry.delivery.alertId, destinationId: retry.delivery.destinationId }
        return sendDwmWebhookDeliveryResult(res, userId, orgId, input, [retry.delivery])
    }

    const submittedReport = req.body?.alert?.report
    if (submittedReport !== undefined) {
        const destinationId = clean(input.destinationId) || clean(input.destination_id)
        if (!destinationId) {
            return res.status(400).send({ error: 'Select one configured destination for third-party report delivery.', code: 'report_destination_required' })
        }
        const canonical = await canonicalThirdPartyReportForDelivery({
            submittedReport,
            organizationId: orgId,
            alertId: req.body?.alert?.id,
            dedupeKey: req.body?.alert?.dedupeKey,
            actorId: userId,
            authorization: clean(req.headers.authorization),
        })
        if (!canonical.report) return res.status(canonical.status).send({ error: canonical.error, code: canonical.code })
        input = {
            ...input,
            destinationId,
            dedupeKey: canonical.report.exportChecksum,
            alert: {
                ...input.alert,
                report: canonical.report,
                dedupeKey: canonical.report.exportChecksum,
                evidenceCount: Number((canonical.report.reportPolicy as Record<string, unknown>).evidenceCount),
            },
        }
    }

    const orgName = orgId === userId ? undefined : await loadOrganizationName(orgId)
    let deliveries
    try {
        deliveries = await triggerDwmAlertWebhookNotification(userId, { ...input.alert, ...input, orgId, orgName }, input)
    } catch (error) {
        if (!(typeof error === 'object' && error && 'blockers' in error)) throw error
        const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || 'delivery_contract_invalid') : 'delivery_contract_invalid'
        return res.status(400).send({
            error: error instanceof Error ? error.message : 'Webhook delivery contract is invalid.',
            code,
            blockers: typeof error === 'object' && error && 'blockers' in error ? (error as { blockers?: unknown }).blockers : undefined,
        })
    }
    return sendDwmWebhookDeliveryResult(res, userId, orgId, input, deliveries)
}
