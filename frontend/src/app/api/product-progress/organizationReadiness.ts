import type { FetchResult } from './routeHelpers'
import type { DwmOrganizationSummary, DwmWatchlistSummary } from '@/app/dashboard/operatorConsoleModel'
import type { EntitlementReadiness, OrganizationAlertExportReadiness } from '@/utils/productProgress/readinessTypes'

export function orgAlertExportReadiness(input: {
    generatedAt: string
    route: string
    organization?: DwmOrganizationSummary
    watchlists: DwmWatchlistSummary[]
    fetchOk: boolean
    fetchStatus: number
    fetchError?: string
    readinessProof?: OrganizationWorker3ReadinessProof
}): OrganizationAlertExportReadiness {
    const readinessProof = input.readinessProof
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const activeTermCount = activeWatchlists.reduce((sum, item) => sum + (item.terms || []).length, 0)
    const proofTermCount = readinessProof?.counts.activeWatchlistTermCount
    const canGenerateAlerts = readinessProof?.readiness.organizationCanGenerateAlerts === true
    const normalizedTermCount = typeof proofTermCount === 'number' ? proofTermCount : activeTermCount
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for watchlist alert routing.',
        readinessProof ? '' : input.fetchOk ? 'Organization alert eligibility details were not returned.' : input.fetchError || `Watchlist route returned HTTP ${input.fetchStatus}.`,
        canGenerateAlerts ? '' : 'Organization policy does not allow alert generation.',
        normalizedTermCount > 0 ? '' : 'No active watchlist terms were returned for alert generation.',
        ...blockersFromProof(readinessProof).filter(blocker => blocker !== 'role_not_allowed'),
    ].filter(Boolean)
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/findings',
        organizationId: input.organization?.id,
        activeTermCount: normalizedTermCount,
        pausedCount: readinessProof?.counts.pausedWatchlistCount ?? input.watchlists.filter(item => item.status === 'paused').length,
        archivedCount: readinessProof?.counts.archivedWatchlistCount ?? 0,
        canGenerateAlerts: blockers.length === 0,
        exportedAt: input.generatedAt,
        blockers,
        ownerLane: 'org',
        unavailableReason: blockers.length ? 'missing_org_alert_export_readiness_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: input.generatedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: readinessProof?.schemaVersion || 'organization.worker3_ui_readiness_proof.v1',
        detail: blockers.length ? blockers.join('; ') : `${normalizedTermCount} active shared watchlist term${normalizedTermCount === 1 ? '' : 's'} loaded for alert generation.`,
    }
}

type OrganizationWorker3ReadinessProof = {
    schemaVersion: 'organization.worker3_ui_readiness_proof.v1'
    organizationId?: string
    tenantId?: string
    actor?: {
        role?: string
        canExportActiveTerms?: boolean
    }
    counts: {
        activeMemberCount?: number
        activeAdminCount?: number
        pendingInviteCount?: number
        activeWatchlistTermCount?: number
        pausedWatchlistCount?: number
        archivedWatchlistCount?: number
    }
    readiness: {
        organizationCanGenerateAlerts?: boolean
        actorCanExportActiveTerms?: boolean
        readyForWorker3Replay?: boolean
        readyForDashboard?: boolean
        cleanupRequired?: boolean
    }
    blockers?: string[]
}

export function organizationReadinessProof(result: FetchResult): OrganizationWorker3ReadinessProof | undefined {
    const payload = result.json as { alertReadiness?: { readinessProof?: unknown } } | undefined
    const proof = payload?.alertReadiness?.readinessProof
    if (!proof || typeof proof !== 'object') return undefined
    const candidate = proof as Partial<OrganizationWorker3ReadinessProof>
    if (candidate.schemaVersion !== 'organization.worker3_ui_readiness_proof.v1') return undefined
    if (!candidate.counts || typeof candidate.counts !== 'object') return undefined
    if (!candidate.readiness || typeof candidate.readiness !== 'object') return undefined
    return candidate as OrganizationWorker3ReadinessProof
}

function blockersFromProof(proof: OrganizationWorker3ReadinessProof | undefined) {
    return Array.isArray(proof?.blockers) ? proof.blockers.filter(Boolean).map(String) : []
}

export function entitlementReadinessFromOrganizationProof(input: {
    generatedAt: string
    route: string
    organization?: DwmOrganizationSummary
    fetch: FetchResult
    readinessProof?: OrganizationWorker3ReadinessProof
}): EntitlementReadiness {
    const readinessProof = input.readinessProof
    const proofBlockers = blockersFromProof(readinessProof)
    const readinessAllowsExport = readinessProof?.readiness.actorCanExportActiveTerms === true
    const actorAllowsExport = readinessProof?.actor ? readinessProof.actor.canExportActiveTerms === true : false
    const allowed = readinessAllowsExport || actorAllowsExport
    const explicitPolicyDeny = Boolean(readinessProof && !allowed)
    const blockers = [
        input.organization ? '' : 'No selected organization was loaded for access policy.',
        readinessProof || input.fetch.ok ? '' : input.fetch.error || `Organization status route returned HTTP ${input.fetch.status}.`,
        readinessProof ? '' : 'Organization access policy was not returned.',
        allowed ? '' : 'Organization access policy does not allow this actor to export active watchlist terms.',
        ...proofBlockers,
    ].filter(Boolean)
    const role = readinessProof?.actor?.role || 'unknown'
    return {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: blockers.length ? explicitPolicyDeny ? 'blocked' : 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/findings',
        organizationId: input.organization?.id || readinessProof?.organizationId,
        policy: 'organization_readiness',
        allowed,
        checkedRole: role,
        blockers,
        ownerLane: 'org',
        unavailableReason: blockers.length ? 'missing_dwm_entitlement_readiness_api' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: input.generatedAt,
        expectedDashboardRowId: 'entitlement_readiness',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.actor.canExportActiveTerms, readinessProof.readiness.actorCanExportActiveTerms, and blockers.',
        backendProofContractVersion: readinessProof?.schemaVersion || 'dwm.entitlement.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `Organization access policy allows ${role} to export active watchlist terms.`,
    }
}
