import type { DashboardAlertEvidenceReadiness, AnalystWorkflowReadiness, DeployProbeReadiness, OrganizationAlertExportReadiness, WebhookHealthReadiness } from './readinessTypes'
import { visibleChecks } from './readinessLabels'
import { unavailableDashboardEvidence, unavailableAnalystWorkflow, unavailableDeployProbe, unavailableOrgAlertExport, unavailableWebhookHealth } from './readinessFallbacks'
import { minutesBetween } from './sourceProofWorkflow'
import { dashboardEvidenceUnavailableReason } from './readinessNormalizeSecondary'
import { deployProbeDetail } from './readinessDetails'

export function normalizeDashboardEvidenceReadiness(input: DashboardAlertEvidenceReadiness | undefined, context: {
    checkedAt: string
    sourceGrowthReady: boolean
}): DashboardAlertEvidenceReadiness {
    if (!input) return unavailableDashboardEvidence('Dashboard alert evidence unavailable', context.checkedAt)
    const blockers = [
        input.visibleInDashboard ? '' : 'Visible dashboard alert is syncing.',
        input.deliveryEvidenceMatched ? '' : 'Matching delivery evidence is syncing.',
        context.sourceGrowthReady || input.sourceProxyReady ? '' : 'Source reachability is syncing.',
        input.deployProbeFresh ? '' : 'Fresh deploy check is syncing.',
        ...(input.blockers || []),
    ].filter(Boolean)
    return {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || context.checkedAt,
        href: input.href || input.dashboardPath || '/dashboard',
        blockers,
        ownerLane: input.ownerLane || 'dashboard',
        unavailableReason: blockers.length ? input.unavailableReason || dashboardEvidenceUnavailableReason(input, context.sourceGrowthReady) : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 600,
        proofTimestamp: input.proofTimestamp || input.checkedAt || context.checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'dashboard_evidence',
        integrationProbeHint: input.integrationProbeHint || 'Dashboard evidence is ready when a live alert is visible, delivery evidence matches it, sources are reachable, and deploy probe is fresh.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dashboard.alert_evidence.readiness.v1',
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `Dashboard alert ${input.alertId} matches delivery ${input.deliveryId}.`),
    }
}

export function normalizeAnalystWorkflowReadiness(input: AnalystWorkflowReadiness | undefined, context: {
    checkedAt: string
    dashboardEvidence: DashboardAlertEvidenceReadiness
    route: string
}): AnalystWorkflowReadiness {
    if (!input) return unavailableAnalystWorkflow(context.route, context.checkedAt)
    const caseMatchesDashboardAlert = Boolean(input.caseId && input.alertId && context.dashboardEvidence.alertId === input.alertId)
    const blockers = [
        input.caseId ? '' : 'Analyst case id is syncing.',
        caseMatchesDashboardAlert ? '' : 'Analyst case is not linked to the dashboard-visible alert yet.',
        input.caseDetailReady ? '' : 'Analyst case detail state is loading.',
        context.dashboardEvidence.status === 'ready' ? '' : 'Dashboard alert evidence is syncing.',
        ...(input.blockers || []),
    ].filter(Boolean)
    return {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || context.checkedAt,
        source: input.source || [context.route, input.caseDetailRoute].filter(Boolean).join(' + '),
        href: input.href || (input.caseId ? `/ti/workbench?case=${encodeURIComponent(input.caseId)}` : '/ti/workbench'),
        blockers,
        ownerLane: input.ownerLane || 'dashboard',
        unavailableReason: blockers.length ? input.unavailableReason || (input.caseDetailReady ? 'missing_analyst_case_readiness' : 'missing_analyst_case_detail_readiness') : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 600,
        proofTimestamp: input.proofTimestamp || input.latestCaseAt || input.checkedAt || context.checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'analyst_workflow',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/cases must return a case linked to the dashboard-visible alert and GET /api/cases/:id must return readable detail with timeline evidence.',
        backendProofContractVersion: input.backendProofContractVersion || [input.schemaVersion || 'analyst.workflow.readiness.v1', input.caseDetailSchemaVersion].filter(Boolean).join(' + '),
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `Analyst case ${input.caseId} is linked to dashboard alert ${input.alertId} and detail route ${input.caseDetailRoute || '/api/cases/:id'} is readable.`),
    }
}

export function normalizeDeployProbeReadiness(input: DeployProbeReadiness | undefined, context: {
    checkedAt: string
    staleAfterMinutes: number
    dashboardEvidence: DashboardAlertEvidenceReadiness
    route: string
}): DeployProbeReadiness {
    if (!input) return unavailableDeployProbe(context.route, context.checkedAt)
    const latestProbeAt = input.latestProbeAt || input.checkedAt
    const fresh = latestProbeAt ? minutesBetween(latestProbeAt, context.checkedAt) <= context.staleAfterMinutes : false
    const servicesReady = input.frontendHealthy === true && input.apiHealthy === true && input.scraperHealthy === true
    const proofMatched = Boolean(context.dashboardEvidence.status === 'ready' && context.dashboardEvidence.alertId && context.dashboardEvidence.deliveryId)
    const blockers = [
        fresh ? '' : latestProbeAt ? `Deploy check is stale; latest check ${latestProbeAt}.` : 'Deploy check time is syncing.',
        servicesReady ? '' : 'Frontend, API, and scraper health are syncing with the deploy check.',
        proofMatched ? '' : 'Deploy check is linking to a dashboard-visible alert and matching delivery.',
        ...(input.blockers || []),
    ].filter(Boolean)
    const next: DeployProbeReadiness = {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || context.checkedAt,
        latestProbeAt,
        source: input.source || context.route,
        href: input.href || '/status',
        dashboardAlertId: input.dashboardAlertId || context.dashboardEvidence.alertId,
        deliveryId: input.deliveryId || context.dashboardEvidence.deliveryId,
        blockers,
        ownerLane: input.ownerLane || 'integration',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_live_deploy_probe' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 600,
        proofTimestamp: input.proofTimestamp || latestProbeAt || context.checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'deploy_probe',
        integrationProbeHint: input.integrationProbeHint || 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'product.deploy_probe.readiness.v1',
    }
    return {
        ...next,
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : deployProbeDetail(next)),
    }
}

export function normalizeOrgAlertExportReadiness(input: OrganizationAlertExportReadiness | undefined, source: string, checkedAt: string): OrganizationAlertExportReadiness {
    if (!input) return unavailableOrgAlertExport(source, checkedAt)
    const blockers = [
        input.canGenerateAlerts ? '' : 'Organization alert-term export is not alertable yet.',
        typeof input.activeTermCount === 'number' && input.activeTermCount > 0 ? '' : 'Organization alert-term export is checking active terms.',
        ...(input.blockers || []),
    ].filter(Boolean)
    return {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || input.exportedAt || checkedAt,
        source: input.source || source,
        href: input.href || '/findings',
        blockers,
        ownerLane: input.ownerLane || 'org',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_org_alert_export_readiness_api' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.exportedAt || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'org_alert_export',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'organization.worker3_ui_readiness_proof.v1',
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `${input.activeTermCount} active alert term${input.activeTermCount === 1 ? '' : 's'} exported for alert generation.`),
    }
}

export function normalizeWebhookHealthReadiness(input: WebhookHealthReadiness | undefined, source: string, checkedAt: string): WebhookHealthReadiness {
    if (!input) return unavailableWebhookHealth(source, checkedAt)
    const blockers = [
        typeof input.activeDestinationCount === 'number' && input.activeDestinationCount > 0 ? '' : 'Webhook destination state is loading.',
        typeof input.deliveryReadyCount === 'number' && input.deliveryReadyCount > 0 ? '' : 'Webhook destination is checking delivery-ready evidence.',
        ...(input.blockers || []),
    ].filter(Boolean)
    return {
        ...input,
        status: blockers.length ? 'needs_action' : input.status === 'ready' ? 'ready' : 'needs_action',
        checkedAt: input.checkedAt || input.latestDeliveryAt || input.latestAuditEventAt || checkedAt,
        source: input.source || source,
        href: input.href || '/automation?setup=dwm',
        blockers,
        ownerLane: input.ownerLane || 'webhook',
        unavailableReason: blockers.length ? input.unavailableReason || 'missing_webhook_lifecycle_health_api' : undefined,
        staleAfterSeconds: input.staleAfterSeconds ?? 900,
        proofTimestamp: input.proofTimestamp || input.latestDeliveryAt || input.latestAuditEventAt || input.checkedAt || checkedAt,
        expectedDashboardRowId: input.expectedDashboardRowId || 'webhook_health',
        integrationProbeHint: input.integrationProbeHint || 'GET /api/findings/webhooks must return active destination count and lifecycle health, not only delivery rows.',
        backendProofContractVersion: input.backendProofContractVersion || input.schemaVersion || 'dwm.webhook_health.readiness.v1',
        detail: input.detail || (blockers.length ? visibleChecks(blockers) : `${input.activeDestinationCount} active webhook destination${input.activeDestinationCount === 1 ? '' : 's'} with ${input.deliveryReadyCount} delivery-ready route${input.deliveryReadyCount === 1 ? '' : 's'}.`),
    }
}
