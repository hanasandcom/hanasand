import type { PublicTiProvenanceReadiness, OrganizationAlertExportReadiness, DwmProductSnapshotReadiness, EntitlementReadiness, WebhookHealthReadiness } from './readinessTypes'
import type { DeliveryProofRow } from './readinessInputTypes'
import { isDurableDelivered } from './readinessSelection'
import { readinessSnapshot, readinessSnapshotSpecs } from './readinessSnapshot'
import { normalizeEntitlementReadinessInput } from './readinessEntitlement'

export function currentCommit() {
    return process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.GIT_SHA || undefined
}

export function actionNeededPublicTi(source: string, checkedAt: string): PublicTiProvenanceReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.publicTi, 'needs_action', source, checkedAt, {
        detail: 'Public TI source details need to be connected to this console summary.',
        blockers: ['Attach source, evidence, confidence, and freshness from public TI before using this row for customer routing.'],
        integrationProbeHint: 'GET /api/public-ti/provenance/status must return source, evidence, confidence, and freshness status.',
    })
}

export function actionNeededOrgAlertExport(source: string, checkedAt: string): OrganizationAlertExportReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.orgAlertExport, 'needs_action', source, checkedAt, {
        detail: 'Active organization watchlist terms need to be connected to alert routing.',
        blockers: ['Connect active organization watchlist terms and alert-routing permission before customer alert generation.'],
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
    })
}

export function actionNeededDwmProduct(source: string, checkedAt: string): DwmProductSnapshotReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.dwmProduct, 'needs_action', source, checkedAt, {
        detail: 'Live DWM product data needs to be connected to this console summary.',
        blockers: ['Connect /api/findings/product before treating the homepage summary as live-backed.'],
        integrationProbeHint: 'GET /api/findings/product must return watchlist, source coverage, and alert status from the TI backend.',
    })
}

export function entitlementReadiness(input: EntitlementReadiness | undefined, source: string, checkedAt: string): EntitlementReadiness {
    if (!input) {
        return readinessSnapshot(readinessSnapshotSpecs.entitlement, 'needs_action', source, checkedAt, {
            detail: 'Organization access policy is not connected to this console summary yet.',
            blockers: ['Connect policy, role, and allowed alert-routing actions before customer routing.'],
            integrationProbeHint: 'GET /api/findings/entitlements/status must return policy, checked role, allowed action, and blockers.',
        })
    }

    return normalizeEntitlementReadinessInput(input, source, checkedAt, {
        blocker: 'DWM entitlement policy does not allow this workflow.',
        integrationProbeHint: 'GET /api/findings/entitlements/status must return policy, checked role, allowed action, and blockers.',
        detail: (_input, blockers) => blockers.length ? blockers.join('; ') : 'DWM entitlement policy allows alert operations.',
    })
}

export function webhookHealthFromDeliveries(source: string, checkedAt: string, deliveries: DeliveryProofRow[]): WebhookHealthReadiness {
    const deliveryReadyCount = deliveries.filter(row => isDurableDelivered(row.status)).length
    return {
        ...readinessSnapshot(readinessSnapshotSpecs.webhookHealth, 'needs_action', source, checkedAt, {
            detail: 'Delivery rows can be counted, but webhook destination lifecycle health is not wired into product progress yet.',
            blockers: ['Webhook owner must expose destination lifecycle health before this can become ready.'],
            integrationProbeHint: 'GET /api/findings/webhooks must return active destination count and lifecycle health, and GET /api/findings/webhooks/deliveries must return persisted delivery rows.',
        }),
        destinationCount: undefined,
        activeDestinationCount: undefined,
        deliveryReadyCount,
        latestDeliveryAt: deliveries.map(row => row.attemptedAt || row.createdAt).filter(Boolean).sort().at(-1),
        proofTimestamp: deliveries.map(row => row.attemptedAt || row.createdAt).filter(Boolean).sort().at(-1) || checkedAt,
    }
}
