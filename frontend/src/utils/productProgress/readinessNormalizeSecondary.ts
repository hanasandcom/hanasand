import type { ReadinessStatus, DashboardAlertEvidenceReadiness, EntitlementReadiness, DwmProductSnapshotReadiness, DwmAlertGenerationReadiness } from './readinessTypes'
import { visibleChecks } from './readinessLabels'
import { unavailableEntitlementReadiness, unavailableDwmProduct, unavailableAlertGenerationReadiness } from './readinessFallbacks'
import { entitlementDetail, dwmProductDetail } from './readinessDetails'

export function dashboardEvidenceUnavailableReason(input: DashboardAlertEvidenceReadiness, sourceGrowthReady: boolean) {
    if (!input.visibleInDashboard) return 'missing_dashboard_alert'
    if (!input.deliveryEvidenceMatched) return 'missing_matching_delivery'
    if (!sourceGrowthReady && !input.sourceProxyReady) return 'missing_source_proxy_worker_readiness'
    if (!input.deployProbeFresh) return 'missing_live_deploy_probe'
    return 'dashboard_evidence_needs_action'
}

export function normalizeEntitlementReadiness(input: EntitlementReadiness | undefined, source: string, checkedAt: string): EntitlementReadiness {
    if (!input) return unavailableEntitlementReadiness(source, checkedAt)
    const blockers = [
        input.allowed ? '' : 'DWM entitlement policy blocks this organization or role.',
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
        integrationProbeHint: input.integrationProbeHint || 'GET /api/findings/entitlements/readiness must return policy, checked role, allowed action, and blockers.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dwm.entitlement.readiness.v1',
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : entitlementDetail(input)),
    }
}

export function normalizeDwmProductReadiness(input: DwmProductSnapshotReadiness | undefined, source: string, checkedAt: string): DwmProductSnapshotReadiness {
    if (!input) return unavailableDwmProduct(source, checkedAt)
    const blockers = input.blockers || []
    return {
        ...input,
        status: input.status === 'unavailable' ? 'unavailable' : blockers.length ? input.status === 'blocked' ? 'blocked' : 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || checkedAt,
        source: input.source || source,
        href: input.href || '/findings',
        blockers,
        ownerLane: input.ownerLane || 'dwm',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_dwm_product_snapshot' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.latestAlertAt || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'dwm_product_snapshot',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/findings/product must return watchlist, source coverage, and alert status from the TI service.',
        backendProofContractVersion: input.backendProofContractVersion || 'dwm.product.v1',
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : dwmProductDetail(input)),
    }
}

export function normalizeAlertGenerationReadiness(input: DwmAlertGenerationReadiness | undefined, source: string, checkedAt: string): DwmAlertGenerationReadiness {
    if (!input) return unavailableAlertGenerationReadiness(source, checkedAt)
    const candidateCountKnown = typeof input.candidateCount === 'number' || typeof input.matchedCandidateCount === 'number'
    const candidateCount = input.candidateCount ?? input.matchedCandidateCount ?? 0
    const captureCount = input.generationEvidenceWindowCaptureCount ?? input.captureRefCount ?? 0
    const blockers = [
        input.readyForCustomerDelivery === true ? '' : 'Alert generation is not ready for customer delivery.',
        input.generationEvidenceWindowReady === true ? '' : 'Alert generation is missing evidence-window timestamps.',
        candidateCountKnown ? '' : 'Alert generation did not return candidate counts.',
        candidateCount > 0 ? '' : 'Alert generation returned no alert candidates.',
        ...(input.blockers || []),
    ].filter(Boolean)
    const status: ReadinessStatus = blockers.length
        ? input.status === 'blocked' || input.status === 'unavailable' ? input.status : 'needs_action'
        : 'ready'

    return {
        ...input,
        status,
        checkedAt: input.checkedAt || checkedAt,
        source: input.source || source,
        href: input.href || '/api/findings/alerts/generation-readiness',
        blockers,
        ownerLane: input.ownerLane || 'dwm',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_alert_generation_readiness' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.latestEvidenceAt || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'dashboard_evidence',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/findings/alerts/generation-readiness must return dwm.alert_generation_readiness.v1 with candidates and a generation evidence window.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dwm.alert_generation_readiness.v1',
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `${candidateCount} alert generation candidate${candidateCount === 1 ? '' : 's'} backed by ${captureCount} capture reference${captureCount === 1 ? '' : 's'}.`),
    }
}

