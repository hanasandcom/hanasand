import type { PublicTiProvenanceReadiness, HelpdeskAuditReadiness, OrganizationAlertExportReadiness, DwmProductSnapshotReadiness, EntitlementReadiness, WebhookHealthReadiness } from './readinessTypes'
import type { DeliveryProofRow } from './readinessInputTypes'
import { isDurableDelivered } from './readinessSelection'

export function currentCommit() {
    return process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.GIT_SHA || undefined
}

export function actionNeededPublicTi(source: string, checkedAt: string): PublicTiProvenanceReadiness {
    return {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: 'needs_action',
        checkedAt,
        source,
        href: '/ti',
        detail: 'Public TI source details need to be connected to this console summary.',
        blockers: ['Attach source, evidence, confidence, and freshness from public TI before using this row for customer routing.'],
        ownerLane: 'public-ti',
        unavailableReason: 'missing_public_ti_provenance_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'public_ti_provenance',
        integrationProbeHint: 'GET /api/public-ti/provenance/status must return source, evidence, confidence, and freshness status.',
        backendProofContractVersion: 'ti.public_provenance.readiness.v1',
    }
}

export function actionNeededHelpdesk(source: string, checkedAt: string): HelpdeskAuditReadiness {
    return {
        schemaVersion: 'support.audit.readiness.v1',
        status: 'needs_action',
        checkedAt,
        source,
        href: '/helpdesk',
        detail: 'Support action and audit history need to be connected to this console summary.',
        blockers: ['Connect support action history and recovery queue audit data before treating this as enterprise-ready.'],
        ownerLane: 'helpdesk',
        unavailableReason: 'missing_helpdesk_audit_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'GET /api/admin/support/status must return structured audit and recovery queue status.',
        backendProofContractVersion: 'support.audit.readiness.v1',
    }
}

export function actionNeededOrgAlertExport(source: string, checkedAt: string): OrganizationAlertExportReadiness {
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'needs_action',
        checkedAt,
        source,
        href: '/findings',
        detail: 'Active organization watchlist terms need to be connected to alert routing.',
        blockers: ['Connect active organization watchlist terms and alert-routing permission before customer alert generation.'],
        ownerLane: 'org',
        unavailableReason: 'missing_org_alert_export_readiness_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
    }
}

export function actionNeededDwmProduct(source: string, checkedAt: string): DwmProductSnapshotReadiness {
    return {
        schemaVersion: 'dwm.product_snapshot.readiness.v1',
        status: 'needs_action',
        checkedAt,
        source,
        href: '/findings',
        detail: 'Live DWM product data needs to be connected to this console summary.',
        blockers: ['Connect /api/findings/product before treating the homepage summary as live-backed.'],
        ownerLane: 'dwm',
        unavailableReason: 'missing_dwm_product_snapshot',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dwm_product_snapshot',
        integrationProbeHint: 'GET /api/findings/product must return watchlist, source coverage, and alert status from the TI backend.',
        backendProofContractVersion: 'dwm.product.v1',
    }
}

export function entitlementReadiness(input: EntitlementReadiness | undefined, source: string, checkedAt: string): EntitlementReadiness {
    if (!input) {
        return {
            schemaVersion: 'dwm.entitlement.readiness.v1',
            status: 'needs_action',
            checkedAt,
            source,
            href: '/findings',
            detail: 'Organization access policy is not connected to this console summary yet.',
            blockers: ['Connect policy, role, and allowed alert-routing actions before customer routing.'],
            ownerLane: 'org',
            unavailableReason: 'missing_dwm_entitlement_readiness_api',
            staleAfterSeconds: 900,
            proofTimestamp: checkedAt,
            expectedDashboardRowId: 'entitlement_readiness',
            integrationProbeHint: 'GET /api/findings/entitlements/status must return policy, checked role, allowed action, and blockers.',
            backendProofContractVersion: 'dwm.entitlement.readiness.v1',
        }
    }

    const blockers = [
        input.allowed ? '' : 'DWM entitlement policy does not allow this workflow.',
        ...(input.blockers || []),
    ].filter(Boolean)

    return {
        ...input,
        status: blockers.length ? 'blocked' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || checkedAt,
        source: input.source || source,
        href: input.href || '/findings',
        blockers,
        ownerLane: input.ownerLane || 'org',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_dwm_entitlement_readiness_api' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'entitlement_readiness',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/findings/entitlements/status must return policy, checked role, allowed action, and blockers.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dwm.entitlement.readiness.v1',
        detail: input.detail || (blockers.length ? blockers.join('; ') : 'DWM entitlement policy allows alert operations.'),
    }
}

export function webhookHealthFromDeliveries(source: string, checkedAt: string, deliveries: DeliveryProofRow[]): WebhookHealthReadiness {
    const deliveryReadyCount = deliveries.filter(row => isDurableDelivered(row.status)).length
    return {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: 'needs_action',
        checkedAt,
        source,
        href: '/automation?setup=dwm',
        destinationCount: undefined,
        activeDestinationCount: undefined,
        deliveryReadyCount,
        latestDeliveryAt: deliveries.map(row => row.attemptedAt || row.createdAt).filter(Boolean).sort().at(-1),
        detail: 'Delivery rows can be counted, but webhook destination lifecycle health is not wired into product progress yet.',
        blockers: ['Webhook owner must expose destination lifecycle health before this can become ready.'],
        ownerLane: 'webhook',
        unavailableReason: 'missing_webhook_lifecycle_health_api',
        staleAfterSeconds: 900,
        proofTimestamp: deliveries.map(row => row.attemptedAt || row.createdAt).filter(Boolean).sort().at(-1) || checkedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/findings/webhooks must return active destination count and lifecycle health, and GET /api/findings/webhooks/deliveries must return persisted delivery rows.',
        backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
    }
}

