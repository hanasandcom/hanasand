import type { EntitlementReadiness } from './readinessTypes'

type EntitlementReadinessCopy = {
    blocker: string
    integrationProbeHint: string
    detail: (input: EntitlementReadiness, blockers: string[]) => string
}

export function normalizeEntitlementReadinessInput(
    input: EntitlementReadiness,
    source: string,
    checkedAt: string,
    copy: EntitlementReadinessCopy,
): EntitlementReadiness {
    const blockers = [input.allowed ? '' : copy.blocker, ...(input.blockers || [])].filter(Boolean)
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
        integrationProbeHint: input.integrationProbeHint || copy.integrationProbeHint,
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dwm.entitlement.readiness.v1',
        detail: input.detail || copy.detail(input, blockers),
    }
}
