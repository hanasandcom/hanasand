import type { PublicTiProvenanceReadiness, HelpdeskAuditReadiness, DeployProbeReadiness, OrganizationAlertExportReadiness, WebhookHealthReadiness, DwmAlertGenerationReadiness, DashboardAlertEvidenceReadiness, AnalystWorkflowReadiness, EntitlementReadiness, DwmProductSnapshotReadiness } from './readinessTypes'
import type { SourceGrowthReadiness } from './sourceGrowthTypes'
import { sanitizeVisibleOperatorCopy, visibleChecks } from './readinessLabels'

export function publicTiProvenanceDetail(input: PublicTiProvenanceReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const query = input.query ? `${input.query}: ` : ''
    const counts = [
        typeof input.artifactCount === 'number' ? `${input.artifactCount} artifact${input.artifactCount === 1 ? '' : 's'}` : '',
        typeof input.sourceCount === 'number' ? `${input.sourceCount} source${input.sourceCount === 1 ? '' : 's'}` : '',
        typeof input.evidenceCount === 'number' ? `${input.evidenceCount} evidence item${input.evidenceCount === 1 ? '' : 's'}` : '',
        typeof input.dashboardHandoffCount === 'number' ? `${input.dashboardHandoffCount} operator workflow${input.dashboardHandoffCount === 1 ? '' : 's'}` : '',
        typeof input.sourceProvenanceCount === 'number' ? `${input.sourceProvenanceCount} source row${input.sourceProvenanceCount === 1 ? '' : 's'}` : '',
        typeof input.sourceFamilyCoverageCount === 'number' ? `${input.sourceFamilyCoverageCount} source famil${input.sourceFamilyCoverageCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.publicTiReadyFamilyCount === 'number' ? `${input.publicTiReadyFamilyCount} public-TI-ready famil${input.publicTiReadyFamilyCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.alertReadyFamilyCount === 'number' ? `${input.alertReadyFamilyCount} review-ready famil${input.alertReadyFamilyCount === 1 ? 'y' : 'ies'}` : '',
        typeof input.watchlistCandidateCount === 'number' ? `${input.watchlistCandidateCount} watchlist candidate${input.watchlistCandidateCount === 1 ? '' : 's'}` : '',
        typeof input.handoffRouteCount === 'number' ? `${input.handoffRouteCount} handoff route${input.handoffRouteCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? `${query}${counts.join(', ')}.` : `${query}Public sources are active.`
}

export function helpdeskAuditDetail(input: HelpdeskAuditReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const counts = [
        typeof input.auditedActions === 'number' ? `${input.auditedActions} audited action${input.auditedActions === 1 ? '' : 's'}` : '',
        typeof input.openRecoveryRequests === 'number' ? `${input.openRecoveryRequests} open recovery request${input.openRecoveryRequests === 1 ? '' : 's'}` : '',
        typeof input.impersonationSessions === 'number' ? `${input.impersonationSessions} impersonation session${input.impersonationSessions === 1 ? '' : 's'}` : '',
        typeof input.supportQueueDepth === 'number' ? `${input.supportQueueDepth} support request${input.supportQueueDepth === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Helpdesk and audit lanes are active.'
}

export function deployProbeDetail(input: DeployProbeReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const services = [
        input.frontendHealthy ? 'frontend healthy' : '',
        input.apiHealthy ? 'API healthy' : '',
        input.scraperHealthy ? 'scraper healthy' : '',
    ].filter(Boolean)
    const delivery = input.dashboardAlertId && input.deliveryId ? `dashboard alert ${input.dashboardAlertId} matched delivery ${input.deliveryId}` : 'dashboard alert and delivery syncing'
    return `${input.deployedCommit ? `Commit ${input.deployedCommit}; ` : ''}${services.length ? `${services.join(', ')}; ` : ''}${delivery}.`
}

export function orgAlertExportDetail(input: OrganizationAlertExportReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    if (typeof input.activeTermCount === 'number') {
        return `${input.activeTermCount} active alert term${input.activeTermCount === 1 ? '' : 's'} exported; ${input.pausedCount || 0} paused, ${input.archivedCount || 0} archived.`
    }
    return 'Organization alert terms are flowing.'
}

export function webhookHealthDetail(input: WebhookHealthReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const counts = [
        typeof input.activeDestinationCount === 'number' && typeof input.destinationCount === 'number' ? `${input.activeDestinationCount}/${input.destinationCount} active destinations` : '',
        typeof input.deliveryReadyCount === 'number' ? `${input.deliveryReadyCount} delivery-ready` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Webhook health checks are active.'
}

export function alertGenerationDetail(input: DwmAlertGenerationReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const counts = [
        typeof input.candidateCount === 'number' ? `${input.candidateCount} candidate${input.candidateCount === 1 ? '' : 's'}` : '',
        typeof input.captureRefCount === 'number' ? `${input.captureRefCount} capture ref${input.captureRefCount === 1 ? '' : 's'}` : '',
        typeof input.generationEvidenceWindowCaptureCount === 'number' ? `${input.generationEvidenceWindowCaptureCount} evidence-window capture${input.generationEvidenceWindowCaptureCount === 1 ? '' : 's'}` : '',
        typeof input.missingRouteCandidateCount === 'number' ? `${input.missingRouteCandidateCount} delivery route gap${input.missingRouteCandidateCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return counts.length ? counts.join(', ') + '.' : 'Alert generation is active.'
}

export function dashboardEvidenceDetail(input: DashboardAlertEvidenceReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    if (input.alertId && input.deliveryId) return `Dashboard alert ${input.alertId} matches delivery ${input.deliveryId}.`
    return 'Dashboard alert evidence is active.'
}

export function dashboardAlertReadinessDetail(input: DashboardAlertEvidenceReadiness, alertGeneration: DwmAlertGenerationReadiness | undefined) {
    const base = input.detail || dashboardEvidenceDetail(input)
    if (!alertGeneration) return base
    if (alertGeneration.blockers?.length) return `${base} Alert generation: ${visibleChecks(alertGeneration.blockers)}`
    const candidateCount = alertGeneration.candidateCount ?? alertGeneration.matchedCandidateCount
    const captureCount = alertGeneration.generationEvidenceWindowCaptureCount ?? alertGeneration.captureRefCount
    const parts = [
        typeof candidateCount === 'number' ? `${candidateCount} candidate${candidateCount === 1 ? '' : 's'}` : '',
        typeof captureCount === 'number' ? `${captureCount} evidence capture${captureCount === 1 ? '' : 's'}` : '',
        typeof alertGeneration.missingRouteCandidateCount === 'number' ? `${alertGeneration.missingRouteCandidateCount} route gap${alertGeneration.missingRouteCandidateCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return parts.length ? `${base} Alert generation: ${parts.join(', ')}.` : base
}

export function analystWorkflowDetail(input: AnalystWorkflowReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    if (input.caseId && input.alertId) return `Analyst case ${input.caseId} is linked to alert ${input.alertId}.`
    return 'analyst process is active.'
}

export function entitlementDetail(input: EntitlementReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const policy = input.policy ? `${input.policy} policy` : 'entitlement policy'
    const role = input.checkedRole ? ` for ${input.checkedRole}` : ''
    return `DWM ${policy}${role} allows alert operations.`
}

export function sourceGrowthDetail(input: SourceGrowthReadiness) {
    if (input.blockers?.length) return visibleChecks(input.blockers)
    const counts = [
        typeof input.activeSourceCount === 'number' && typeof input.registeredTotal === 'number' ? `${input.activeSourceCount}/${input.registeredTotal} active sources` : '',
        typeof input.catalogCandidates === 'number' ? `${input.catalogCandidates} catalog candidates` : '',
        typeof input.sourceFamilyCount === 'number' ? `${input.sourceFamilyCount} source families` : '',
        typeof input.parserSourceFamilyCount === 'number' ? `${input.parserSourceFamilyCount} parser families` : '',
        typeof input.contractLookupRows === 'number' ? `${input.contractLookupRows} lookup row${input.contractLookupRows === 1 ? '' : 's'}` : '',
        typeof input.receiptMatrixRows === 'number' ? `${input.receiptMatrixRows} delivery-check row${input.receiptMatrixRows === 1 ? '' : 's'}` : '',
        typeof input.netNewCandidates === 'number' ? `${input.netNewCandidates} net-new` : '',
        typeof input.reviewQueueCount === 'number' ? `${input.reviewQueueCount} queued for review` : '',
        typeof input.collectionReadyRows === 'number' ? `${input.collectionReadyRows} worker-ready rows` : '',
    ].filter(Boolean)
    const visibility = sourceGrowthReady(input) ? 'source worker live in the console' : input.proxyExposed ? 'source data visible; worker status syncing' : 'scraper inventory live; console status syncing'
    return counts.length ? `${counts.join(', ')}; ${visibility}.` : visibility + '.'
}

export function sourceWorkerProofSummary(input: SourceGrowthReadiness, blockers: string[], ready: boolean) {
    if (!ready) return sanitizeVisibleOperatorCopy(visibleChecks(blockers) || input.unavailableReason || 'Source worker status is syncing to the operator console.') || 'Source worker status is syncing to the operator console.'
    return [
        `worker ${input.workerStatus || 'ready'}`,
        `${input.collectionReadyRows ?? 0} collection-ready row${input.collectionReadyRows === 1 ? '' : 's'}`,
        `${input.parserSourceFamilyCount ?? 0} parser famil${input.parserSourceFamilyCount === 1 ? 'y' : 'ies'}`,
        `${input.contractLookupRows ?? 0} route lookup row${input.contractLookupRows === 1 ? '' : 's'}`,
        `${input.receiptMatrixRows ?? 0} delivery-check row${input.receiptMatrixRows === 1 ? '' : 's'}`,
        `${input.receiptMatrixBlockedRows ?? 0} delivery-check blocker${input.receiptMatrixBlockedRows === 1 ? '' : 's'}`,
        `last run ${input.workerLastRunAt || 'syncing'}`,
    ].join('; ') + '.'
}

export function dwmProductDetail(input: DwmProductSnapshotReadiness) {
    const counts = [
        typeof input.watchlistTermCount === 'number' ? `${input.watchlistTermCount} watchlist terms` : '',
        typeof input.alertCount === 'number' ? `${input.alertCount} alerts` : '',
        typeof input.sourceFamilyCount === 'number' ? `${input.sourceFamilyCount} source families` : '',
    ].filter(Boolean)
    return counts.length ? `Live DWM monitor has ${counts.join(', ')}.` : 'DWM monitor is checking coverage counts.'
}

export function sourceGrowthReady(input: SourceGrowthReadiness | undefined) {
    return Boolean(input?.proxyExposed && input.inventoryReachable !== false && input.sourcePacksReachable !== false && input.status === 'ready' && input.workerStatus === 'ready')
}
