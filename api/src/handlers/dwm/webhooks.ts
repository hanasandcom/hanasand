import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import {
    organizationVisibilityDecision,
    roleCanEditOrganization,
    type OrganizationVisibilityDecisionInput,
    type OrganizationAlertVisibilityPolicy,
    type OrganizationRole,
} from '#utils/organizations.ts'
import { canonicalThirdPartyReportForDelivery } from '#utils/dwm/thirdPartyReportVerification.ts'
export { canonicalThirdPartyReportForDelivery } from '#utils/dwm/thirdPartyReportVerification.ts'
import {
    clean,
    constantTimeEqual,
    archiveDwmWebhookDestination,
    buildDwmOrgAlertWebhookDeliveryContract,
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookDeliveryActionPlan,
    buildDwmWebhookDeliveryAuditTrail,
    buildDwmWebhookDeliveryAttemptContract,
    buildDwmWebhookDeliveryAttemptPersistenceProof,
    buildDwmWebhookDeliveryAttemptPersistenceReadModel,
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookCustomerSetupProof,
    buildDwmWebhookDestinationCrudContract,
    buildDwmWebhookDestinationAdminProof,
    buildDwmWebhookDestinationDeliveryMatrix,
    buildDwmWebhookDestinationHealth,
    buildDwmWebhookDestinationLifecycle,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDestinationContracts,
    buildDwmWebhookDestinationLookupContract,
    buildDwmWebhookDestinationTestContract,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryHistory,
    buildDwmWebhookDeliveryHistoryConsumerProof,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryPersistenceProof,
    buildDwmWebhookDeliveryReceipts,
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDeliveryReplayGuard,
    buildDwmWebhookDeliveryReplayApiContract,
    buildDwmWebhookDeliveryTimeline,
    buildDwmWebhookDeliveryRetryPersistence,
    buildDwmWebhookDeliveryRetryQueue,
    buildDwmWebhookDeliveryRetryRequestContract,
    buildDwmWebhookDeliveryRetryWorkOrders,
    buildDwmWebhookDeliveryRequestInput,
    buildDwmWebhookDeliveryRetryContract,
    createDwmWebhookDestination,
    buildDwmWebhookDeliveryReadiness,
    triggerDwmAlertWebhookNotification,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    listDwmWebhookReceiverReceipts,
    recordDwmWebhookReceiverReceipt,
    retryDwmWebhookDelivery,
    testDwmWebhookDestination,
    updateDwmWebhookDestination,
    type DwmAlertNotificationInput,
    type DwmWebhookDestinationInput,
} from '#utils/dwm/webhooks.ts'

type IdParams = {
    id: string
}

type OrgQuery = {
    orgId?: string
    org_id?: string
    includeAudit?: string
    destinationId?: string
    destination_id?: string
    alertId?: string
    alert_id?: string
    casePath?: string
    case_path?: string
    dedupeKey?: string
    dedupe_key?: string
    requestId?: string
    request_id?: string
    deliveryId?: string
    delivery_id?: string
    idempotencyKey?: string
    idempotency_key?: string
    action?: string
    status?: string
    timeFrom?: string
    time_from?: string
    timeTo?: string
    time_to?: string
    retryState?: string
    retry_state?: string
    actorId?: string
    actor_id?: string
    reportCaseId?: string
    report_case_id?: string
    reportExportChecksum?: string
    report_export_checksum?: string
}

type Membership = {
    role: OrganizationRole
    status?: 'active' | 'removed'
    user_active?: boolean
    alert_visibility_policy?: OrganizationAlertVisibilityPolicy
    organization_status?: string
    privacy_deletion_run_id?: string | null
}

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

    return res.send({
        destinations,
        destinationContracts: buildDwmWebhookDestinationContracts({ destinations, deliveries, auditEvents }),
        destinationHealth: buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents }),
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
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations, deliveries, auditEvents, ...lifecycleAccess }),
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
        destinationAdminProof: buildDwmWebhookDestinationAdminProof({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({ destinations, deliveries, auditEvents }),
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

export async function postDwmWebhookDestination(req: FastifyRequest<{ Body: DwmWebhookDestinationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = clean(req.body?.orgId) || userId
    const permissionError = await configurationPermissionError(orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const existingDestinations = await listDwmWebhookDestinations(userId, orgId)
    const destinationCrud = buildDwmWebhookDestinationCrudContract({
        action: 'create',
        ownerId: userId,
        input: { ...req.body, orgId },
        destinations: existingDestinations,
        viewerRole: orgId === userId ? 'owner' : 'admin',
        canManage: true,
    })
    if (!destinationCrud.canApply) {
        return res.status(destinationCrud.blockingCodes.includes('duplicate_destination') ? 409 : 400).send({
            error: destinationCrud.blockers[0]?.message || 'Webhook destination cannot be created.',
            destinationCrud,
        })
    }

    try {
        const destination = await createDwmWebhookDestination(userId, { ...req.body, orgId })
        const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
        const destinations = [destination, ...existingDestinations.filter(item => item.id !== destination.id)]
        return res.status(201).send({
            destination,
            destinationCrud: buildDwmWebhookDestinationCrudContract({
                action: 'create',
                ownerId: userId,
                input: { ...req.body, orgId },
                destination,
                destinations,
                auditEvents,
                viewerRole: orgId === userId ? 'owner' : 'admin',
                canManage: true,
            }),
            destinationContract: buildDwmWebhookDestinationContracts({ destinations: [destination], auditEvents })[0],
            destinationHealth: buildDwmWebhookDestinationHealth({ destinations: [destination], auditEvents })[0],
            customerSetup: buildDwmWebhookCustomerSetupProof({ destinations, auditEvents, viewerRole: orgId === userId ? 'owner' : 'admin', canManage: true }),
            destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: [destination], auditEvents, viewerRole: 'owner', canManage: true })[0],
            destinationAdminProof: buildDwmWebhookDestinationAdminProof({ destinations: [destination], auditEvents, viewerRole: 'owner', canManage: true }),
            auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, destinations: [destination] }),
        })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid webhook destination.' })
    }
}

export async function putDwmWebhookDestination(req: FastifyRequest<{ Params: IdParams, Body: DwmWebhookDestinationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    const nextOrgId = clean(req.body?.orgId) || existing.orgId || userId
    const destinationOrgId = existing.orgId || userId
    const permissionError = await configurationPermissionError(destinationOrgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    try {
        const preflight = await loadDestinationCrudContext(userId, destinationOrgId, req.params.id)
        const action = destinationCrudActionForUpdate(req.body, preflight.destination)
        const preflightCrud = buildDwmWebhookDestinationCrudContract({
            action,
            ownerId: userId,
            input: { ...req.body, orgId: nextOrgId },
            destination: preflight.destination,
            destinations: preflight.destinations,
            deliveries: preflight.deliveries,
            auditEvents: preflight.auditEvents,
            viewerRole: 'admin',
            canManage: true,
        })
        if (!preflightCrud.canApply) {
            return res.status(400).send({
                error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be updated.',
                destinationCrud: preflightCrud,
            })
        }

        const destination = await updateDwmWebhookDestination(userId, req.params.id, { ...req.body, orgId: destinationOrgId })
        if (!destination) {
            return res.status(404).send({ error: 'Webhook destination not found.' })
        }
        const deliveries = await listDwmWebhookDeliveries(userId, destination.orgId)
        const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
        const destinations = preflight.destinations.map(item => item.id === destination.id ? destination : item)
        return res.send(buildDwmWebhookDestinationChangeResponse({
            action,
            ownerId: userId,
            input: { ...req.body, orgId: nextOrgId },
            destination,
            destinations,
            deliveries,
            auditEvents,
        }))
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid webhook destination.' })
    }
}

export async function deleteDwmWebhookDestination(req: FastifyRequest<{ Params: IdParams }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    const permissionError = await configurationPermissionError(existing.orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const preflight = await loadDestinationCrudContext(userId, existing.orgId, req.params.id)
    const preflightCrud = buildDwmWebhookDestinationCrudContract({
        action: 'delete',
        ownerId: userId,
        input: { orgId: existing.orgId },
        destination: preflight.destination,
        destinations: preflight.destinations,
        deliveries: preflight.deliveries,
        auditEvents: preflight.auditEvents,
        viewerRole: 'admin',
        canManage: true,
    })
    if (!preflightCrud.canApply) {
        return res.status(400).send({
            error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be deleted.',
            destinationCrud: preflightCrud,
        })
    }

    const destination = await archiveDwmWebhookDestination(userId, req.params.id)
    if (!destination) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }
    const deliveries = await listDwmWebhookDeliveries(userId, destination.orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
    const destinations = [destination, ...preflight.destinations.filter(item => item.id !== destination.id)]
    return res.send(buildDwmWebhookDestinationChangeResponse({
        action: 'delete',
        ownerId: userId,
        input: { orgId: destination.orgId },
        destination,
        destinations,
        deliveries,
        auditEvents,
    }))
}

export function buildDwmWebhookDestinationChangeResponse({
    action,
    ownerId,
    input,
    destination,
    destinations,
    deliveries,
    auditEvents,
    includeDestination = true,
}: {
    action: Parameters<typeof buildDwmWebhookDestinationCrudContract>[0]['action']
    ownerId: string
    input: Parameters<typeof buildDwmWebhookDestinationCrudContract>[0]['input']
    destination: NonNullable<Parameters<typeof buildDwmWebhookDestinationCrudContract>[0]['destination']>
    destinations: Awaited<ReturnType<typeof listDwmWebhookDestinations>>
    deliveries: Awaited<ReturnType<typeof listDwmWebhookDeliveries>>
    auditEvents: Awaited<ReturnType<typeof listDwmWebhookAuditEvents>>
    includeDestination?: boolean
}) {
    const destinationOnly = [destination]
    const viewer = { viewerRole: 'admin' as const, canManage: true }
    return {
        ...(includeDestination ? { destination } : {}),
        destinationCrud: buildDwmWebhookDestinationCrudContract({
            action,
            ownerId,
            input,
            destination,
            destinations,
            deliveries,
            auditEvents,
            ...viewer,
        }),
        destinationContract: buildDwmWebhookDestinationContracts({ destinations: destinationOnly, deliveries, auditEvents })[0],
        destinationHealth: buildDwmWebhookDestinationHealth({ destinations: destinationOnly, deliveries, auditEvents })[0],
        customerSetup: buildDwmWebhookCustomerSetupProof({ destinations, deliveries, auditEvents, ...viewer }),
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: destinationOnly, deliveries, auditEvents, ...viewer })[0],
        destinationAdminProof: buildDwmWebhookDestinationAdminProof({ destinations: destinationOnly, deliveries, auditEvents, ...viewer }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations: destinationOnly }),
    }
}

export async function postDwmWebhookDestinationTest(req: FastifyRequest<{ Params: IdParams, Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    const permissionError = await configurationPermissionError(existing.orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const preflight = await loadDestinationCrudContext(userId, existing.orgId, req.params.id)
    const preflightCrud = buildDwmWebhookDestinationCrudContract({
        action: 'test',
        ownerId: userId,
        input: { ...(req.body || {}), orgId: existing.orgId },
        destination: preflight.destination,
        destinations: preflight.destinations,
        deliveries: preflight.deliveries,
        auditEvents: preflight.auditEvents,
        viewerRole: 'admin',
        canManage: true,
    })
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
    const destinationChangeResponse = destination
        ? buildDwmWebhookDestinationChangeResponse({
            action: 'test',
            ownerId: userId,
            input: { ...(req.body || {}), orgId: existing.orgId },
            destination,
            destinations,
            deliveries,
            auditEvents,
            includeDestination: false,
        })
        : null
    const response = {
        delivery,
        preview: buildDwmWebhookDeliveryPreview(delivery),
        destinationCrud: destination ? destinationChangeResponse!.destinationCrud : null,
        destinationContract: destination ? destinationChangeResponse!.destinationContract : null,
        destinationHealth: destination ? destinationChangeResponse!.destinationHealth : null,
        destinationTest: destination
            ? buildDwmWebhookDestinationTestContract({
                destination,
                deliveries,
                auditEvents,
                viewerRole: 'admin',
                canManage: true,
            })
            : null,
        customerSetup: destination
            ? destinationChangeResponse!.customerSetup
            : buildDwmWebhookCustomerSetupProof({
                destinations,
                deliveries,
                auditEvents,
                viewerRole: 'admin',
                canManage: true,
            }),
        destinationLifecycle: destination ? destinationChangeResponse!.destinationLifecycle : null,
        destinationAdminProof: destination ? destinationChangeResponse!.destinationAdminProof : null,
        auditEventContracts: destination
            ? destinationChangeResponse!.auditEventContracts
            : buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations }),
    }
    const outcome = destinationTestResponseOutcome(delivery)
    return res.status(outcome.status).send(outcome.failed ? { ...response, error: outcome.error, code: outcome.code } : response)
}

export function destinationTestResponseOutcome(delivery: { status?: string | null, error?: unknown }) {
    const failed = webhookResponseFailed(delivery)
    return failed
        ? { status: 502, failed: true, code: 'webhook_destination_test_failed', error: 'Webhook destination test failed.' }
        : { status: 202, failed: false }
}

export function deliveryResponseOutcome(deliveries: Array<{ status?: string | null, error?: unknown }>) {
    const failed = deliveries.some(webhookResponseFailed)
    return failed
        ? { status: 502, failed: true, code: 'webhook_delivery_failed', error: 'Webhook delivery failed.' }
        : { status: 202, failed: false }
}

function webhookResponseFailed(delivery: { status?: string | null, error?: unknown }) {
    return delivery.status === 'failed' || Boolean(delivery.error)
}

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
    const evidence = buildDwmWebhookDeliveryEvidence({
        deliveries,
        auditEvents,
        filters: deliveryFilters,
    })
    const deliveryLedger = buildDwmWebhookDeliveryLedger({
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
    const payload: Record<string, unknown> = {
        deliveries,
        deliveryEvidence: visibilityResult ? visibilityResult.deliveryEvidence : evidence,
        deliveryLedger: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveryLedger,
        deliveryOperations: visibilityResult && !visibilityResult.decision.allowed
            ? {
                schemaVersion: 'dwm.webhook.delivery_operations.v1',
                liveDeliveryEnabled: process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
                filters: deliveryFilters,
                total: 0,
                counts: { queued: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0, live: 0, replay: 0, retryable: 0 },
                recentDeliveries: [],
            }
            : buildDwmWebhookDeliveryOperations({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
            }),
        deliveryHistory: buildDwmWebhookDeliveryHistory({ ...visibleRecords, filters: deliveryFilters }),
        deliveryHistoryConsumer: buildDwmWebhookDeliveryHistoryConsumerProof({
            ...visibleRecords,
            filters: deliveryFilters,
        }),
        deliveryReadinessConsumer: buildDwmWebhookDeliveryReadinessConsumerProof({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryPersistenceProof: buildDwmWebhookDeliveryPersistenceProof({ ...visibleRecords, filters: deliveryFilters }),
        deliveryAttemptPersistence: buildDwmWebhookDeliveryAttemptPersistenceReadModel({
            ...visibleRecords,
            filters: deliveryFilters,
        }),
        deliveryReceipts: buildDwmWebhookDeliveryReceipts({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryTimeline: buildDwmWebhookDeliveryTimeline({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryActionPlan: buildDwmWebhookDeliveryActionPlan({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryReplayGuard: buildDwmWebhookDeliveryReplayGuard({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryReplayApi: buildDwmWebhookDeliveryReplayApiContract({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryRetryPersistence: buildDwmWebhookDeliveryRetryPersistence({ ...visibleRecords, filters: deliveryFilters }),
        deliveryRetryQueue: buildDwmWebhookDeliveryRetryQueue({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryRetryRequest: buildDwmWebhookDeliveryRetryRequestContract({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryRetryWorkOrders: buildDwmWebhookDeliveryRetryWorkOrders({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        destinationDeliveryMatrix: buildDwmWebhookDestinationDeliveryMatrix({
            ...visibleRecords,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        deliveryAuditTrail: buildDwmWebhookDeliveryAuditTrail({
            ...visibleRecords,
            filters: deliveryFilters,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        dashboardReadiness: buildDwmWebhookDashboardReadinessAdapter({
            destinations,
            deliveries,
            auditEvents,
            visibility: visibilityContext,
        }),
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({
            destinations,
            deliveries,
            auditEvents,
        }),
        destinationHealth: buildDwmWebhookDestinationHealth({
            destinations,
            deliveries,
            auditEvents,
        }),
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
        }),
        destinationAdminProof: buildDwmWebhookDestinationAdminProof({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: visibilityContext,
        }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({
            auditEvents,
            deliveries,
            destinations,
        }),
        visibility: visibilityResult?.decision ?? {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members',
            allowedRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        },
    }
    if (req.query?.includeAudit === 'true') {
        payload.auditEvents = auditEvents
    }

    return res.send(payload)
}

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

export async function postDwmWebhookDelivery(req: FastifyRequest<{ Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    let input = buildDwmWebhookDeliveryRequestInput(req.body || {})
    const orgId = clean(input.orgId) || clean(input.organizationId) || clean(input.tenantId) || userId
    const permissionError = await configurationPermissionError(orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

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

async function sendDwmWebhookDeliveryResult(res: FastifyReply, userId: string, orgId: string, input: DwmAlertNotificationInput, deliveries: Awaited<ReturnType<typeof triggerDwmAlertWebhookNotification>>) {
    const destinations = await listDwmWebhookDestinations(userId, orgId)
    const ledgerDeliveries = await listDwmWebhookDeliveries(userId, orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, orgId)
    const filters = {
        orgId,
        destinationId: clean(input.destinationId) || clean(input.destination_id),
        alertId: clean(input.alertId) || clean(input.alert?.id),
        casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
        dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
    }
    const deliveryAccess = { viewerRole: 'admin' as const, canManage: true }
    const response = {
        deliveries,
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
        }),
        destinationHealth: buildDwmWebhookDestinationHealth({ destinations, deliveries: ledgerDeliveries, auditEvents }),
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations, deliveries: ledgerDeliveries, auditEvents, ...deliveryAccess }),
        destinationAdminProof: buildDwmWebhookDestinationAdminProof({
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            ...deliveryAccess,
        }),
        deliveryOperations: buildDwmWebhookDeliveryOperations({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
        }),
        deliveryHistory: buildDwmWebhookDeliveryHistory({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
        }),
        deliveryReadinessConsumer: buildDwmWebhookDeliveryReadinessConsumerProof({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryPersistenceProof: buildDwmWebhookDeliveryPersistenceProof({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
        }),
        deliveryAttemptContract: buildDwmWebhookDeliveryAttemptContract({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
        }),
        deliveryAttemptPersistence: buildDwmWebhookDeliveryAttemptPersistenceProof({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
        }),
        deliveryReceipts: buildDwmWebhookDeliveryReceipts({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryTimeline: buildDwmWebhookDeliveryTimeline({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryActionPlan: buildDwmWebhookDeliveryActionPlan({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryReplayGuard: buildDwmWebhookDeliveryReplayGuard({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryRetry: buildDwmWebhookDeliveryRetryContract({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            canManage: true,
        }),
        deliveryRetryPersistence: buildDwmWebhookDeliveryRetryPersistence({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
        }),
        deliveryRetryQueue: buildDwmWebhookDeliveryRetryQueue({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryRetryRequest: buildDwmWebhookDeliveryRetryRequestContract({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        deliveryRetryWorkOrders: buildDwmWebhookDeliveryRetryWorkOrders({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        destinationDeliveryMatrix: buildDwmWebhookDestinationDeliveryMatrix({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            ...deliveryAccess,
        }),
        deliveryAuditTrail: buildDwmWebhookDeliveryAuditTrail({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters,
            ...deliveryAccess,
        }),
        dashboardReadiness: buildDwmWebhookDashboardReadinessAdapter({
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            visibility: null,
        }),
        orgAlertDelivery: buildDwmOrgAlertWebhookDeliveryContract({
            ownerId: userId,
            input,
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            ...deliveryAccess,
        }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries: ledgerDeliveries, destinations }),
        dryRunDefault: true,
        liveDeliveryEnabled: process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    }
    const outcome = deliveryResponseOutcome(deliveries)
    return res.status(outcome.status).send(outcome.failed ? { ...response, error: outcome.error, code: outcome.code } : response)
}

async function authenticatedUserId(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    return id
}

function serviceTokenMatches(value: string | string[] | undefined) {
    const expected = process.env.TI_SCRAPER_SERVICE_TOKEN || ''
    const presented = Array.isArray(value) ? value[0] || '' : value || ''
    return constantTimeEqual(expected, presented)
}

async function updatePreview(destinationId: string, userId: string) {
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

async function configurationPermissionError(orgId: string, userId: string) {
    if (!orgId || orgId === userId) return null
    const membership = await loadOrganizationMembership(orgId, userId)
    if (!membership) {
        return { status: 404, message: 'Organization not found.' }
    }
    if (membership.privacy_deletion_run_id || membership.organization_status !== 'active') {
        return { status: 409, message: membership.privacy_deletion_run_id ? 'Organization deletion is in progress; writes are blocked.' : 'Organization lifecycle blocks webhook changes.' }
    }
    if (!roleCanEditOrganization(membership.role)) {
        return { status: 403, message: 'Only organization owners, admins, and editors can configure webhook destinations.' }
    }
    return null
}

function destinationLifecycleAccess(orgId: string, userId: string, membership: Membership | null) {
    const role = orgId && orgId !== userId ? membership?.role || null : 'owner'
    return {
        viewerRole: role,
        canManage: roleCanEditOrganization(role || undefined),
    }
}

export function webhookOrganizationVisibilityContext(
    orgId: string,
    userId: string,
    membership: Membership | null,
    options: { membershipIsActive?: boolean } = {},
): OrganizationVisibilityDecisionInput | null {
    if (!orgId || orgId === userId) return null
    const membershipIsActive = options.membershipIsActive === true
    return {
        role: membership?.role,
        status: membershipIsActive ? 'active' : membership?.status,
        userActive: membershipIsActive ? true : membership?.user_active,
        alertVisibilityPolicy: membership?.alert_visibility_policy,
    }
}

function destinationCrudActionForUpdate(input: DwmWebhookDestinationInput, destination: { status?: string } | null) {
    const nextStatus = clean(input.status)
    if (destination && destination.status !== 'active' && nextStatus === 'active') return 'enable' as const
    return 'update' as const
}

async function loadDestinationCrudContext(ownerId: string, orgId: string, destinationId: string) {
    const destinations = await listDwmWebhookDestinations(ownerId, orgId)
    const destination = destinations.find(item => item.id === destinationId) || null
    const deliveries = await listDwmWebhookDeliveries(ownerId, orgId)
    const auditEvents = await listDwmWebhookAuditEvents(ownerId, orgId)
    return { destinations, destination, deliveries, auditEvents }
}

async function loadOrganizationMembership(orgId: string, userId: string): Promise<Membership | null> {
    const result = await run(`
        SELECT member.role, organization.status AS organization_status,
               organization.audit_safe_metadata->>'privacyDeletionRunId' AS privacy_deletion_run_id
        FROM organization_members member
        JOIN organizations organization ON organization.id = member.organization_id
        WHERE member.organization_id = $1
          AND member.user_id = $2
          AND member.status = 'active'
        LIMIT 1
    `, [orgId, userId])

    return result.rows[0] as Membership | undefined || null
}

async function loadOrganizationName(orgId: string): Promise<string | undefined> {
    const result = await run('SELECT name FROM organizations WHERE id = $1 LIMIT 1', [orgId])
    return clean((result.rows[0] as { name?: string } | undefined)?.name) || undefined
}

async function loadOrganizationVisibilityMembership(orgId: string, userId: string): Promise<Membership | null> {
    const result = await run(`
        SELECT
            om.role,
            om.status,
            u.active AS user_active,
            o.alert_visibility_policy
        FROM organizations o
        LEFT JOIN organization_members om
          ON om.organization_id = o.id
         AND om.user_id = $2
        LEFT JOIN users u
          ON u.id = $2
        WHERE o.id = $1
        LIMIT 1
    `, [orgId, userId])

    return result.rows[0] as Membership | undefined || null
}

function orgIdFromQuery(query: OrgQuery | undefined) {
    return firstQueryValue(query, 'orgId', 'org_id')
}

function firstQueryValue(query: OrgQuery | undefined, ...keys: Array<keyof OrgQuery>) {
    for (const key of keys) {
        const value = clean(query?.[key])
        if (value) return value
    }
    return ''
}
