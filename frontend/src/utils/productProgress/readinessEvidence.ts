import type { AnalystWorkflowReadiness, DashboardAlertEvidenceReadiness } from './readinessTypes'
import type { AlertProofRow, AnalystCaseDetailProofInput, AnalystCaseProofRow, DeliveryProofRow, DwmAlertGenerationReadinessInput } from './readinessInputTypes'
import { chooseCaseForAlert } from './readinessSelection'

export function dashboardEvidenceFromRows(input: {
    checkedAt: string
    route: string
    alert?: AlertProofRow
    delivery?: DeliveryProofRow
    alertGeneration?: DwmAlertGenerationReadinessInput
    sourceProxyReady: boolean
    deployProbeFresh: boolean
}): DashboardAlertEvidenceReadiness {
    const visibleInDashboard = Boolean(input.alert?.id)
    const deliveryEvidenceMatched = Boolean(input.alert?.id && input.delivery?.alertId === input.alert.id && input.delivery.id)
    const alertGenerationReady = input.alertGeneration?.status === 'ready'
        && input.alertGeneration.readyForCustomerDelivery === true
        && input.alertGeneration.generationEvidenceWindowReady === true
    const alertGenerationDetail = alertGenerationReady
        ? `${input.alertGeneration?.candidateCount ?? 0} alert generation candidate${input.alertGeneration?.candidateCount === 1 ? '' : 's'} with ${input.alertGeneration?.generationEvidenceWindowCaptureCount ?? 0} evidence-window capture${input.alertGeneration?.generationEvidenceWindowCaptureCount === 1 ? '' : 's'} through ${input.alertGeneration?.latestEvidenceAt || 'the latest status check'}.`
        : input.alertGeneration?.blockers?.filter(Boolean).join('; ') || 'Connect DWM alert generation status.'
    const blockers = [
        visibleInDashboard ? '' : 'No dashboard-visible backend alert was loaded.',
        deliveryEvidenceMatched ? '' : 'No delivery row matched the dashboard-visible alert.',
        input.sourceProxyReady ? '' : 'Source proxy and worker readiness are not both loaded.',
        input.deployProbeFresh ? '' : 'Deploy probe recency is not loaded.',
        alertGenerationReady ? '' : alertGenerationDetail,
    ].filter(Boolean)
    return {
        schemaVersion: 'dashboard.alert_evidence.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.checkedAt,
        source: input.route,
        href: '/dashboard',
        alertId: input.alert?.id,
        deliveryId: input.delivery?.id,
        visibleInDashboard,
        deliveryEvidenceMatched,
        sourceProxyReady: input.sourceProxyReady,
        deployProbeFresh: input.deployProbeFresh,
        dashboardPath: input.alert?.id ? `/dashboard?case=${encodeURIComponent(input.alert.id)}` : '/dashboard',
        blockers,
        ownerLane: 'dashboard',
        unavailableReason: blockers.length ? dashboardEvidenceUnavailableReason({
            visibleInDashboard,
            deliveryEvidenceMatched,
            sourceProxyReady: input.sourceProxyReady,
            deployProbeFresh: input.deployProbeFresh,
            alertGenerationReady,
        }) : undefined,
        staleAfterSeconds: 600,
        proofTimestamp: input.alertGeneration?.proofTimestamp || input.alert?.updatedAt || input.alert?.createdAt || input.checkedAt,
        expectedDashboardRowId: 'dashboard_evidence',
        integrationProbeHint: 'Dashboard evidence is ready only when a backend alert is visible, delivery evidence matches it, source proxy is ready, deploy probe is fresh, and /api/findings/alerts/generation-readiness returns customer-delivery readiness with a generation evidence window.',
        backendProofContractVersion: input.alertGeneration?.schemaVersion || 'dashboard.alert_evidence.readiness.v1',
        detail: blockers.length ? blockers.join('; ') : `Dashboard alert ${input.alert?.id} matches delivery ${input.delivery?.id}. ${alertGenerationDetail}`,
    }
}

export function analystWorkflowFromRows(input: {
    checkedAt: string
    route: string
    alert?: AlertProofRow
    cases: AnalystCaseProofRow[]
    caseDetail?: AnalystCaseDetailProofInput
}): AnalystWorkflowReadiness {
    const analystCase = chooseCaseForAlert(input.alert?.id, input.cases)
    const latestCaseAt = analystCase?.updatedAt || analystCase?.createdAt
    const detailMatchesCase = Boolean(
        input.caseDetail?.fetchOk
        && analystCase?.id
        && input.caseDetail.caseId === analystCase.id
        && (!input.caseDetail.alertId || input.caseDetail.alertId === analystCase.alertId),
    )
    const detailAccessReady = Boolean(input.caseDetail?.readOnly || input.caseDetail?.canMutate)
    const detailTimelineReady = Boolean((input.caseDetail?.timelineCount || 0) > 0)
    const detailReady = Boolean(detailMatchesCase && detailAccessReady && detailTimelineReady)
    const blockers = [
        input.alert?.id ? '' : 'No dashboard-visible backend alert was loaded.',
        analystCase?.id ? '' : 'No analyst case is linked to the dashboard-visible alert.',
        input.caseDetail?.fetchOk ? '' : input.caseDetail?.fetchError || (input.caseDetail?.fetchStatus ? `Case detail route returned HTTP ${input.caseDetail.fetchStatus}.` : 'Case detail route was not loaded.'),
        detailMatchesCase ? '' : 'Case detail route did not return the selected analyst case.',
        detailAccessReady ? '' : 'Case detail route did not expose a readable access mode.',
        detailTimelineReady ? '' : 'Case detail route did not include timeline evidence.',
        latestCaseAt ? '' : 'Analyst case timestamp is missing.',
    ].filter(Boolean)
    return {
        schemaVersion: 'analyst.workflow.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.checkedAt,
        source: [input.route, input.caseDetail?.route].filter(Boolean).join(' + ') || input.route,
        href: analystCase?.id ? `/ti/workbench?case=${encodeURIComponent(analystCase.id)}` : '/ti/workbench',
        caseId: analystCase?.id,
        alertId: analystCase?.alertId,
        caseStatus: analystCase?.status,
        assignedOwner: analystCase?.assignedOwner,
        latestCaseAt,
        caseDetailReady: detailReady,
        caseDetailRoute: input.caseDetail?.route,
        caseDetailSchemaVersion: input.caseDetail?.schemaVersion,
        caseDetailTimelineCount: input.caseDetail?.timelineCount,
        caseDetailReadOnly: input.caseDetail?.readOnly,
        blockers,
        ownerLane: 'dashboard',
        unavailableReason: blockers.length ? detailReady ? 'missing_analyst_case_readiness' : 'missing_analyst_case_detail_readiness' : undefined,
        staleAfterSeconds: 600,
        proofTimestamp: input.caseDetail?.proofTimestamp || latestCaseAt || input.checkedAt,
        expectedDashboardRowId: 'analyst_workflow',
        integrationProbeHint: 'GET /api/cases must return a case linked to the dashboard-visible alert and GET /api/cases/:id must return readable detail with timeline evidence.',
        backendProofContractVersion: ['analyst.workflow.readiness.v1', input.caseDetail?.schemaVersion].filter(Boolean).join(' + '),
        detail: blockers.length ? blockers.join('; ') : `Analyst case ${analystCase?.id} is linked to dashboard alert ${analystCase?.alertId}; case detail includes ${input.caseDetail?.timelineCount || 0} timeline event${input.caseDetail?.timelineCount === 1 ? '' : 's'}.`,
    }
}

export function dashboardEvidenceUnavailableReason(input: {
    visibleInDashboard: boolean
    deliveryEvidenceMatched: boolean
    sourceProxyReady: boolean
    deployProbeFresh: boolean
    alertGenerationReady?: boolean
}) {
    if (!input.visibleInDashboard) return 'missing_dashboard_alert'
    if (!input.deliveryEvidenceMatched) return 'missing_matching_delivery'
    if (!input.sourceProxyReady) return 'missing_source_proxy_worker_readiness'
    if (!input.deployProbeFresh) return 'missing_live_deploy_probe'
    if (!input.alertGenerationReady) return 'missing_alert_generation_readiness'
    return 'dashboard_evidence_needs_action'
}
