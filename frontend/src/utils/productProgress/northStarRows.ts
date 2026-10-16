import type { ProductReadinessExternalState } from './sourceGrowthTypes'
import type { ProductReadinessSnapshotBase } from './readinessTypes'
import type { ReadinessStatus } from './readinessTypes'
import type { ProductNorthStarRow, ProductNorthStarRowId } from './northStarTypes'
import { withProofFreshness } from './northStarProof'

export function organizationsRow(external: ProductReadinessExternalState, generatedAt: string): ProductNorthStarRow {
    const entitlement = external.entitlement
    const orgExport = external.orgAlertExport
    const state = combineState(entitlement?.status, orgExport?.status)
    const blocker = [
        rowBlocker(entitlement, 'Connect organization access policy.'),
        rowBlocker(orgExport, 'Connect organization alert-term export.'),
    ].filter(Boolean).join(' ')
    const displayState = homepageSeverity(state, blocker)
    return withProofFreshness({
        id: 'organizations',
        label: 'Organizations',
        state: displayState,
        ownerLane: entitlement?.ownerLane || orgExport?.ownerLane || 'org',
        detail: displayState === 'ready' ? 'Organization policy and alert-term export are both connected.' : 'Organization access needs policy and alert-term export data.',
        href: entitlement?.href || orgExport?.href || '/findings',
        proofSource: [entitlement?.source, orgExport?.source].filter(Boolean).join(' + ') || 'Organization status source not connected',
        proofTimestamp: latestTimestamp([entitlement?.proofTimestamp, orgExport?.proofTimestamp, generatedAt]) || generatedAt,
        staleAfterSeconds: Math.min(entitlement?.staleAfterSeconds || 900, orgExport?.staleAfterSeconds || 900),
        expectedDashboardRowId: [entitlement?.expectedDashboardRowId || 'entitlement_readiness', orgExport?.expectedDashboardRowId || 'org_alert_export'].join(','),
        backendProofContractVersion: [entitlement?.backendProofContractVersion || entitlement?.schemaVersion, orgExport?.backendProofContractVersion || orgExport?.schemaVersion].filter(Boolean).join(' + ') || 'organization.readiness.v1',
        blocker: displayState === 'ready' ? '' : blocker || 'Organization policy data is incomplete.',
        integrationProbeHint: [entitlement?.integrationProbeHint, orgExport?.integrationProbeHint].filter(Boolean).join(' ') || 'Load organization policy and alert-term export status.',
    })
}

export function homepageSeverity(state: ReadinessStatus, blocker: string): ReadinessStatus {
    if (state !== 'blocked') return state
    return /\b(denied|does not allow|not allowed|forbidden|blocked by policy)\b/i.test(blocker) ? 'blocked' : 'needs_action'
}

export function realAlertGenerationRow(external: ProductReadinessExternalState, generatedAt: string): ProductNorthStarRow {
    const dashboard = external.dashboardEvidence
    const generation = external.alertGeneration
    const generationReady = Boolean(
        generation?.status === 'ready'
        && generation.readyForCustomerDelivery === true
        && generation.generationEvidenceWindowReady === true,
    )
    const state = dashboard?.status === 'ready' && generationReady
        ? 'ready'
        : combineState(dashboard?.status, generation?.status)
    const blocker = [
        rowBlocker(dashboard, 'Generate a dashboard-visible alert for the selected customer.'),
        generationReady ? '' : rowBlocker(generation, 'Connect alert generation status.'),
    ].filter(Boolean).join(' ')
    const candidateCount = generation?.candidateCount ?? generation?.matchedCandidateCount ?? 0
    const captureCount = generation?.generationEvidenceWindowCaptureCount ?? generation?.captureRefCount ?? 0
    const proofContracts = uniqueStrings([
        'dashboard.alert_evidence.readiness.v1',
        dashboard?.backendProofContractVersion || dashboard?.schemaVersion,
        generation?.backendProofContractVersion || generation?.schemaVersion,
    ])

    return withProofFreshness({
        id: 'real_alert_generation',
        label: 'Real alert generation',
        state,
        ownerLane: dashboard?.ownerLane || generation?.ownerLane || 'dwm',
        detail: state === 'ready'
            ? `${candidateCount} alert candidate${candidateCount === 1 ? '' : 's'} backed by ${captureCount} capture reference${captureCount === 1 ? '' : 's'}.`
            : blocker || 'Alert generation status is incomplete.',
        href: '/ti/workbench',
        proofSource: [dashboard?.source, generation?.source].filter(Boolean).join(' + ') || 'Alert generation source not connected',
        proofTimestamp: latestTimestamp([dashboard?.proofTimestamp, generation?.proofTimestamp, generatedAt]) || generatedAt,
        staleAfterSeconds: Math.min(dashboard?.staleAfterSeconds || 600, generation?.staleAfterSeconds || 900),
        expectedDashboardRowId: [dashboard?.expectedDashboardRowId || 'dashboard_evidence', generation?.expectedDashboardRowId || 'alert_generation_readiness'].join(','),
        backendProofContractVersion: proofContracts.join(' + ') || 'dashboard.alert_evidence.readiness.v1 + dwm.alert_generation_readiness.v1',
        blocker: state === 'ready' ? '' : blocker || 'Alert generation status is incomplete.',
        integrationProbeHint: [dashboard?.integrationProbeHint, generation?.integrationProbeHint].filter(Boolean).join(' ') || 'GET /api/findings/alerts/generation-status and dashboard alert evidence must both be connected.',
    })
}

export function webhookDeliveryRow(external: ProductReadinessExternalState, generatedAt: string): ProductNorthStarRow {
    const health = external.webhookHealth
    const dashboard = external.dashboardEvidence
    const hasMatchedDelivery = dashboard?.deliveryEvidenceMatched === true && Boolean(dashboard.deliveryId)
    const state = health?.status === 'ready' && hasMatchedDelivery ? 'ready' : health?.status === 'blocked' ? 'blocked' : 'needs_action'
    return withProofFreshness({
        id: 'webhook_delivery',
        label: 'Webhook delivery',
        state,
        ownerLane: health?.ownerLane || 'webhook',
        detail: state === 'ready' ? 'Webhook lifecycle and matched delivery data are connected.' : 'Webhook delivery needs lifecycle data and a delivery matched to a dashboard alert.',
        href: health?.href || '/automation?setup=dwm',
        proofSource: health?.source || 'DWM webhook health source not connected',
        proofTimestamp: latestTimestamp([health?.proofTimestamp, dashboard?.proofTimestamp, generatedAt]) || generatedAt,
        staleAfterSeconds: Math.min(health?.staleAfterSeconds || 900, dashboard?.staleAfterSeconds || 600),
        expectedDashboardRowId: [health?.expectedDashboardRowId || 'webhook_health', dashboard?.expectedDashboardRowId || 'dashboard_evidence'].join(','),
        backendProofContractVersion: [health?.backendProofContractVersion || health?.schemaVersion, dashboard?.backendProofContractVersion || dashboard?.schemaVersion].filter(Boolean).join(' + ') || 'dwm.webhook.readiness.v1',
        blocker: state === 'ready' ? '' : [rowBlocker(health, 'Connect webhook lifecycle status.'), hasMatchedDelivery ? '' : 'No delivery row is matched to a dashboard-visible alert.'].filter(Boolean).join(' '),
        integrationProbeHint: health?.integrationProbeHint || 'GET /api/findings/webhooks must return active destination count and lifecycle health.',
    })
}

export function snapshotRow(input: {
    id: ProductNorthStarRowId
    label: string
    snapshot?: ProductReadinessSnapshotBase & { schemaVersion?: string }
    fallbackHref: string
    fallbackOwner: string
    fallbackExpectedDashboardRowId: string
    fallbackContract: string
    fallbackProbe: string
    fallbackBlocker: string
    readyDetail: string
    hrefOverride?: string
}): ProductNorthStarRow {
    const snapshot = input.snapshot
    const state = normalizeDisplayState(snapshot?.status)
    return withProofFreshness({
        id: input.id,
        label: input.label,
        state,
        ownerLane: snapshot?.ownerLane || input.fallbackOwner,
        detail: state === 'ready' ? input.readyDetail : snapshot?.detail || input.fallbackBlocker,
        href: input.hrefOverride || snapshot?.href || input.fallbackHref,
        proofSource: snapshot?.source || input.fallbackBlocker,
        proofTimestamp: snapshot?.proofTimestamp || snapshot?.checkedAt || new Date().toISOString(),
        staleAfterSeconds: snapshot?.staleAfterSeconds || 900,
        expectedDashboardRowId: snapshot?.expectedDashboardRowId || input.fallbackExpectedDashboardRowId,
        backendProofContractVersion: snapshot?.backendProofContractVersion || snapshot?.schemaVersion || input.fallbackContract,
        blocker: state === 'ready' ? '' : rowBlocker(snapshot, input.fallbackBlocker),
        integrationProbeHint: snapshot?.integrationProbeHint || input.fallbackProbe,
    })
}

export function publicTiEnrichmentRow(external: ProductReadinessExternalState, query: string): ProductNorthStarRow {
    const row = snapshotRow({
        id: 'public_ti_enrichment',
        label: 'Public TI enrichment',
        snapshot: external.publicTiProvenance,
        fallbackHref: actorIntelligenceHref(query),
        fallbackOwner: 'public-ti',
        fallbackExpectedDashboardRowId: 'public_ti_provenance',
        fallbackContract: 'ti.public_provenance.readiness.v1',
        fallbackProbe: 'GET /api/public-ti/provenance/status must return source, evidence, confidence, and freshness status.',
        fallbackBlocker: 'Attach public TI source details and freshness.',
        readyDetail: 'Public TI enrichment has source, evidence, and freshness data.',
    })
    if (row.href === '/ti') return { ...row, href: actorIntelligenceHref(query) }
    return row
}

export function actorIntelligenceHref(query: string) {
    const slug = query.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
    return slug ? `/ti/${encodeURIComponent(slug)}` : '/ti'
}

export function combineState(...states: Array<ReadinessStatus | undefined>): ReadinessStatus {
    if (states.some(state => state === 'blocked')) return 'blocked'
    if (states.length && states.every(state => state === 'ready')) return 'ready'
    if (states.some(state => state === 'needs_action')) return 'needs_action'
    return 'needs_action'
}

export function normalizeDisplayState(state: ReadinessStatus | undefined): ReadinessStatus {
    return state === 'ready' || state === 'blocked' || state === 'needs_action' ? state : 'needs_action'
}

export function rowBlocker(snapshot: ProductReadinessSnapshotBase | undefined, fallback: string) {
    if (!snapshot) return fallback
    if (snapshot.status === 'ready') return ''
    if (snapshot.unavailableReason) return snapshot.unavailableReason
    if (snapshot.blockers?.length) return snapshot.blockers.join(' ')
    return snapshot.detail || fallback
}

export function latestTimestamp(values: Array<string | undefined>) {
    return values
        .filter(Boolean)
        .sort()
        .at(-1)
}

export function uniqueStrings(values: Array<string | undefined>) {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))))
}
