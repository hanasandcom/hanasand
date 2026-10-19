import type { ProductReadinessSnapshotBase, ReadinessStatus } from './readinessTypes'

type ReadinessSnapshotSpec = {
    schemaVersion: string
    href: string
    ownerLane: NonNullable<ProductReadinessSnapshotBase['ownerLane']>
    unavailableReason: string
    staleAfterSeconds: number
    expectedDashboardRowId: string
    backendProofContractVersion: string
}

type SnapshotWording = Required<Pick<ProductReadinessSnapshotBase, 'detail' | 'blockers' | 'integrationProbeHint'>>

export const readinessSnapshotSpecs = {
    publicTi: {
        schemaVersion: 'ti.public_provenance.readiness.v1', href: '/ti', ownerLane: 'public-ti',
        unavailableReason: 'missing_public_ti_provenance_readiness_api', staleAfterSeconds: 3600,
        expectedDashboardRowId: 'public_ti_provenance', backendProofContractVersion: 'ti.public_provenance.readiness.v1',
    },
    orgAlertExport: {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1', href: '/findings', ownerLane: 'org',
        unavailableReason: 'missing_org_alert_export_readiness_api', staleAfterSeconds: 900,
        expectedDashboardRowId: 'org_alert_export', backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
    },
    dwmProduct: {
        schemaVersion: 'dwm.product_snapshot.readiness.v1', href: '/findings', ownerLane: 'dwm',
        unavailableReason: 'missing_dwm_product_snapshot', staleAfterSeconds: 900,
        expectedDashboardRowId: 'dwm_product_snapshot', backendProofContractVersion: 'dwm.product.v1',
    },
    webhookHealth: {
        schemaVersion: 'dwm.webhook_health.readiness.v1', href: '/automation?setup=dwm', ownerLane: 'webhook',
        unavailableReason: 'missing_webhook_lifecycle_health_api', staleAfterSeconds: 900,
        expectedDashboardRowId: 'webhook_health', backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
    },
    entitlement: {
        schemaVersion: 'dwm.entitlement.readiness.v1', href: '/findings', ownerLane: 'org',
        unavailableReason: 'missing_dwm_entitlement_readiness_api', staleAfterSeconds: 900,
        expectedDashboardRowId: 'entitlement_readiness', backendProofContractVersion: 'dwm.entitlement.readiness.v1',
    },
} satisfies Record<string, ReadinessSnapshotSpec>

export function readinessSnapshot(
    spec: ReadinessSnapshotSpec,
    status: ReadinessStatus,
    source: string,
    checkedAt: string,
    wording: SnapshotWording,
): ProductReadinessSnapshotBase & { schemaVersion: string } {
    return {
        schemaVersion: spec.schemaVersion,
        status,
        checkedAt,
        source,
        href: spec.href,
        detail: wording.detail,
        blockers: wording.blockers,
        ownerLane: spec.ownerLane,
        unavailableReason: spec.unavailableReason,
        staleAfterSeconds: spec.staleAfterSeconds,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: spec.expectedDashboardRowId,
        integrationProbeHint: wording.integrationProbeHint,
        backendProofContractVersion: spec.backendProofContractVersion,
    }
}
