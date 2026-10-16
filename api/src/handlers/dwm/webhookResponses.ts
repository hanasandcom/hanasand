import {
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookCustomerSetupProof,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDestinationAdminProof,
    buildDwmWebhookDestinationContracts,
    buildDwmWebhookDestinationCrudContract,
    buildDwmWebhookDestinationHealth,
    buildDwmWebhookDestinationLifecycle,
    buildDwmWebhookDestinationTestContract,
    type DwmAlertNotificationInput,
} from '#utils/dwm/webhooks.ts'
import {
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    testDwmWebhookDestination,
} from '#utils/dwm/webhooks.ts'

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

export function buildDwmWebhookDestinationTestResponse({
    delivery,
    ownerId,
    orgId,
    input,
    destination,
    destinations,
    deliveries,
    auditEvents,
}: {
    delivery: NonNullable<Awaited<ReturnType<typeof testDwmWebhookDestination>>>
    ownerId: string
    orgId: string
    input: DwmAlertNotificationInput
    destination: Awaited<ReturnType<typeof listDwmWebhookDestinations>>[number] | null | undefined
    destinations: Awaited<ReturnType<typeof listDwmWebhookDestinations>>
    deliveries: Awaited<ReturnType<typeof listDwmWebhookDeliveries>>
    auditEvents: Awaited<ReturnType<typeof listDwmWebhookAuditEvents>>
}) {
    const destinationChangeResponse = destination
        ? buildDwmWebhookDestinationChangeResponse({
            action: 'test',
            ownerId,
            input: { ...input, orgId },
            destination,
            destinations,
            deliveries,
            auditEvents,
            includeDestination: false,
        })
        : null

    return {
        delivery,
        preview: buildDwmWebhookDeliveryPreview(delivery),
        destinationCrud: destinationChangeResponse?.destinationCrud ?? null,
        destinationContract: destinationChangeResponse?.destinationContract ?? null,
        destinationHealth: destinationChangeResponse?.destinationHealth ?? null,
        destinationTest: destination
            ? buildDwmWebhookDestinationTestContract({
                destination,
                deliveries,
                auditEvents,
                viewerRole: 'admin',
                canManage: true,
            })
            : null,
        customerSetup: destinationChangeResponse
            ? destinationChangeResponse.customerSetup
            : buildDwmWebhookCustomerSetupProof({
                destinations,
                deliveries,
                auditEvents,
                viewerRole: 'admin',
                canManage: true,
            }),
        destinationLifecycle: destinationChangeResponse?.destinationLifecycle ?? null,
        destinationAdminProof: destinationChangeResponse?.destinationAdminProof ?? null,
        auditEventContracts: destinationChangeResponse
            ? destinationChangeResponse.auditEventContracts
            : buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations }),
    }
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
