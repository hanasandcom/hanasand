import type { DwmWebhookProductProgressProof, FetchResult } from './routeHelpers'
import type { DwmDeliveryItem, DwmOrganizationSummary, DwmOrganizationWebhookDestination } from '@/app/dashboard/operatorConsoleModel'
import type { WebhookHealthReadiness } from '@/utils/productProgress/readinessTypes'
import { isDurableDelivered } from '@/utils/productProgress/readiness'

export function webhookHealthReadiness(input: {
    generatedAt: string
    route: string
    organization?: DwmOrganizationSummary
    productProgress?: DwmWebhookProductProgressProof
    destinations: DwmOrganizationWebhookDestination[]
    deliveries: DwmDeliveryItem[]
    fetchOk: boolean
    fetchStatus: number
    fetchError?: string
}): WebhookHealthReadiness {
    if (input.productProgress) {
        const proof = input.productProgress
        const blockerCodes = Array.isArray(proof.blockerCodes) ? proof.blockerCodes.filter(Boolean).map(String) : []
        const blockers = [
            input.organization ? '' : 'No selected organization was loaded for webhook readiness.',
            input.fetchOk ? '' : input.fetchError || `Organization webhook route returned HTTP ${input.fetchStatus}.`,
            proof.status === 'ready' ? '' : 'Webhook delivery status is not ready.',
            ...blockerCodes.map(code => `Webhook blocker: ${code}.`),
        ].filter(Boolean)
        return {
            schemaVersion: 'dwm.webhook_health.readiness.v1',
            status: blockers.length ? 'needs_action' : 'ready',
            checkedAt: input.generatedAt,
            source: input.route,
            href: proof.href || '/automation?setup=dwm',
            destinationCount: proof.destinationCount,
            activeDestinationCount: proof.activeDestinationCount,
            deliveryReadyCount: proof.deliveryReadyCount,
            latestDeliveryAt: input.deliveries.map(row => row.attemptedAt).filter(Boolean).sort().at(-1),
            latestAuditEventAt: input.destinations.map(row => row.lastTestedAt || row.updatedAt).filter(Boolean).sort().at(-1),
            blockers,
            ownerLane: 'webhook',
            unavailableReason: blockers.length ? 'missing_webhook_lifecycle_health_api' : undefined,
            staleAfterSeconds: 900,
            proofTimestamp: input.generatedAt,
            expectedDashboardRowId: 'webhook_health',
            integrationProbeHint: 'GET /api/organizations/:id/webhooks must return destinationAdminProof.productProgress with dwm.webhook.destination_admin_product_progress.v1, and GET /api/findings/webhooks/deliveries must return persisted delivery rows.',
            backendProofContractVersion: proof.schemaVersion,
            detail: blockers.length
                ? blockers.join('; ')
                : `${proof.activeDestinationCount || 0} active webhook destination${proof.activeDestinationCount === 1 ? '' : 's'} with ${proof.deliveryReadyCount || 0} delivery-ready destination${proof.deliveryReadyCount === 1 ? '' : 's'}.`,
        }
    }

    const activeDestinations = input.destinations.filter(item => item.status === 'active')
    const deliveryReadyCount = input.deliveries.filter(row => isDurableDelivered(row.status)).length
    const latestDeliveryAt = input.deliveries.map(row => row.attemptedAt).filter(Boolean).sort().at(-1)
    const latestAuditEventAt = input.destinations.map(row => row.lastTestedAt || row.updatedAt).filter(Boolean).sort().at(-1)
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for webhook readiness.',
        input.fetchOk ? '' : input.fetchError || `Organization webhook route returned HTTP ${input.fetchStatus}.`,
        activeDestinations.length ? '' : 'No active webhook destination was returned for this organization.',
        deliveryReadyCount > 0 ? '' : 'No delivery-ready webhook evidence was returned.',
    ].filter(Boolean)
    return {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/automation?setup=dwm',
        destinationCount: input.destinations.length,
        activeDestinationCount: activeDestinations.length,
        deliveryReadyCount,
        latestDeliveryAt,
        latestAuditEventAt,
        blockers,
        ownerLane: 'webhook',
        unavailableReason: blockers.length ? 'missing_webhook_lifecycle_health_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: latestDeliveryAt || latestAuditEventAt || input.generatedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/organizations/:id/webhooks and GET /api/findings/webhooks/deliveries must return active destinations and persisted delivery evidence.',
        backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `${activeDestinations.length} active webhook destination${activeDestinations.length === 1 ? '' : 's'} with ${deliveryReadyCount} delivery-ready row${deliveryReadyCount === 1 ? '' : 's'}.`,
    }
}

export function webhookProductProgressProof(result: FetchResult): DwmWebhookProductProgressProof | undefined {
    const payload = result.json as { destinationAdminProof?: { productProgress?: unknown } } | undefined
    const proof = payload?.destinationAdminProof?.productProgress
    if (!proof || typeof proof !== 'object') return undefined
    const candidate = proof as Partial<DwmWebhookProductProgressProof>
    if (candidate.schemaVersion !== 'dwm.webhook.destination_admin_product_progress.v1') return undefined
    return candidate as DwmWebhookProductProgressProof
}
