import type { FastifyReply, FastifyRequest } from 'fastify'
import {
    buildDwmWebhookCustomerSetupProof,
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookDestinationLookupContract,
    buildDwmWebhookDestinationReadModels,
    buildDwmWebhookDestinationTestContract,
    buildDwmWebhookDeliveryAuditTrail,
    buildDwmWebhookDeliveryPersistenceProof,
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDeliveryRetryQueue,
    buildDwmWebhookDeliveryRetryRequestContract,
    buildDwmWebhookDeliveryRetryWorkOrders,
    buildDwmWebhookDestinationDeliveryMatrix,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
} from '#utils/dwm/webhooks.ts'
import { authenticatedUserId } from './webhookRouteAuth.ts'
import {
    destinationLifecycleAccess,
    loadOrganizationMembership,
    webhookOrganizationVisibilityContext,
} from './webhookRouteOrganizations.ts'
import { orgIdFromQuery, type OrgQuery } from './webhookRouteTypes.ts'

export async function getDwmWebhookDestinations(req: FastifyRequest<{ Querystring: OrgQuery }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = orgIdFromQuery(req.query)
    const membership = orgId && orgId !== userId ? await loadOrganizationMembership(orgId, userId) : null
    if (orgId && orgId !== userId && !membership) {
        return res.status(404).send({ error: 'Organization not found.' })
    }
    const lifecycleAccess = destinationLifecycleAccess(orgId, userId, membership)
    const visibilityContext = webhookOrganizationVisibilityContext(orgId, userId, membership, { membershipIsActive: true })

    const destinations = await listDwmWebhookDestinations(userId, orgId || undefined)
    const deliveries = await listDwmWebhookDeliveries(userId, orgId || undefined)
    const auditEvents = await listDwmWebhookAuditEvents(userId, orgId || undefined)
    const destinationReadModels = buildDwmWebhookDestinationReadModels({
        destinations,
        deliveries,
        auditEvents,
        ...lifecycleAccess,
        visibility: visibilityContext,
    })

    return res.send({
        destinations,
        destinationContracts: destinationReadModels.destinationContracts,
        destinationHealth: destinationReadModels.destinationHealth,
        customerSetup: buildDwmWebhookCustomerSetupProof({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        dashboardReadiness: buildDwmWebhookDashboardReadinessAdapter({
            destinations,
            deliveries,
            auditEvents,
            visibility: visibilityContext,
        }),
        destinationLifecycle: destinationReadModels.destinationLifecycle,
        destinationLookup: buildDwmWebhookDestinationLookupContract({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        destinationTests: destinations.map(destination => buildDwmWebhookDestinationTestContract({
            destination,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
        })),
        destinationAdminProof: destinationReadModels.destinationAdminProof,
        deliveryReadiness: destinationReadModels.deliveryReadiness,
        deliveryRetryQueue: buildDwmWebhookDeliveryRetryQueue({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryRetryRequest: buildDwmWebhookDeliveryRetryRequestContract({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryRetryWorkOrders: buildDwmWebhookDeliveryRetryWorkOrders({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        destinationDeliveryMatrix: buildDwmWebhookDestinationDeliveryMatrix({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryAuditTrail: buildDwmWebhookDeliveryAuditTrail({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryPersistenceProof: buildDwmWebhookDeliveryPersistenceProof({
            deliveries,
            auditEvents,
            destinations,
            filters: { orgId },
        }),
        deliveryReadinessConsumer: buildDwmWebhookDeliveryReadinessConsumerProof({
            destinations,
            deliveries,
            auditEvents,
            filters: { orgId },
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations }),
    })
}
