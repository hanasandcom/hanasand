import type { FastifyReply, FastifyRequest } from 'fastify'
import { organizationVisibilityDecision } from '#utils/organizations.ts'
import {
    buildDwmWebhookDeliveryEvidenceAndLedger,
    buildDwmWebhookDeliveryHistoryAndPersistenceReadModels,
    buildDwmWebhookDestinationReadModels,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
} from '#utils/dwm/webhooks.ts'
import { authenticatedUserId } from './webhookRouteAuth.ts'
import {
    destinationLifecycleAccess,
    loadOrganizationVisibilityMembership,
    webhookOrganizationVisibilityContext,
} from './webhookRouteOrganizations.ts'
import { firstQueryValue, orgIdFromQuery, type OrgQuery } from './webhookRouteTypes.ts'
import { buildDwmWebhookDeliveryReadPayload } from './webhookDeliveryReadPayload.ts'

export async function getDwmWebhookDeliveries(req: FastifyRequest<{ Querystring: OrgQuery }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = orgIdFromQuery(req.query)
    const visibility = orgId && orgId !== userId ? await loadOrganizationVisibilityMembership(orgId, userId) : null
    const visibilityContext = webhookOrganizationVisibilityContext(orgId, userId, visibility)
    if (orgId && orgId !== userId) {
        const decision = organizationVisibilityDecision(visibilityContext || {})
        if (!decision.allowed) {
            return res.status(decision.reason === 'not_member' ? 404 : 403).send({
                error: decision.reason === 'not_member' ? 'Organization not found.' : 'Webhook delivery evidence is not visible for this organization membership.',
                reason: decision.reason,
                alertVisibilityPolicy: decision.alertVisibilityPolicy,
                allowedRoles: decision.allowedRoles,
            })
        }
    }

    const alertId = firstQueryValue(req.query, 'alertId', 'alert_id')
    const reportCaseId = firstQueryValue(req.query, 'reportCaseId', 'report_case_id')
    const reportExportChecksum = firstQueryValue(req.query, 'reportExportChecksum', 'report_export_checksum')
    const deliveries = await listDwmWebhookDeliveries(userId, orgId || undefined, {
        alertId,
        reportCaseId,
        reportExportChecksum,
    })
    const auditEvents = await listDwmWebhookAuditEvents(userId, orgId || undefined)
    const destinations = await listDwmWebhookDestinations(userId, orgId || undefined)
    const deliveryFilters = {
        orgId,
        destinationId: firstQueryValue(req.query, 'destinationId', 'destination_id'),
        alertId,
        casePath: firstQueryValue(req.query, 'casePath', 'case_path'),
        dedupeKey: firstQueryValue(req.query, 'dedupeKey', 'dedupe_key'),
        requestId: firstQueryValue(req.query, 'requestId', 'request_id', 'deliveryId', 'delivery_id'),
        idempotencyKey: firstQueryValue(req.query, 'idempotencyKey', 'idempotency_key'),
        action: firstQueryValue(req.query, 'action'),
        status: firstQueryValue(req.query, 'status'),
        timeFrom: firstQueryValue(req.query, 'timeFrom', 'time_from'),
        timeTo: firstQueryValue(req.query, 'timeTo', 'time_to'),
        retryState: firstQueryValue(req.query, 'retryState', 'retry_state'),
        actorId: firstQueryValue(req.query, 'actorId', 'actor_id'),
        reportCaseId,
        reportExportChecksum,
    }
    const { evidence, ledger: deliveryLedger } = buildDwmWebhookDeliveryEvidenceAndLedger({
        deliveries,
        auditEvents,
        filters: deliveryFilters,
    })
    const visibilityResult = orgId && orgId !== userId
        ? filterDwmWebhookDeliveryEvidenceForVisibility({
            evidence,
            visibility: visibilityContext || {},
        })
        : null
    const visibleRecords = !visibilityResult || visibilityResult.decision.allowed
        ? { deliveries, auditEvents, destinations }
        : { deliveries: [], auditEvents: [], destinations: [] }
    const lifecycleAccess = destinationLifecycleAccess(orgId, userId, visibility)
    const destinationReadModels = buildDwmWebhookDestinationReadModels({
        destinations,
        deliveries,
        auditEvents,
        ...lifecycleAccess,
        visibility: visibilityContext,
    })
    const deliveryHistoryReadModels = buildDwmWebhookDeliveryHistoryAndPersistenceReadModels({
        ...visibleRecords,
        filters: deliveryFilters,
    })
    const payload = buildDwmWebhookDeliveryReadPayload({
        deliveries,
        auditEvents,
        destinations,
        deliveryFilters,
        evidence,
        deliveryLedger,
        visibilityResult,
        visibleRecords,
        lifecycleAccess,
        visibilityContext,
        destinationReadModels,
        deliveryHistoryReadModels,
        includeAudit: req.query?.includeAudit === 'true',
    })
    return res.send(payload)
}
