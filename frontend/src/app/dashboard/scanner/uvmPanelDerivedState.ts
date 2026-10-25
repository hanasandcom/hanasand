import type { UvmAssessmentMode, UvmDashboard, UvmFindingGroup, UvmFindingHistoryScope, NetworkScanProfile } from '@/utils/monitoring/types'
import { filterAndSortUvmFindingGroups, filterAndSortUvmFindings, type UvmFindingFilters } from './uvmPanelHelpers'
import { buildUvmAssessmentEnginePlan } from './uvmPanelEnginePlans'
import type { UvmAssessmentEngineId } from './uvmPanelAssessmentControls'

export function deriveUvmPanelState({ data, servicesPaused, findingScope, findingFilters, findingSort, assessmentEngines, assessmentScanId, assessmentNmapProfile, assessmentMode }: {
    data: UvmDashboard
    servicesPaused: boolean
    findingScope: UvmFindingHistoryScope | null
    findingFilters: UvmFindingFilters
    findingSort: 'severity' | 'criticality' | 'due-date'
    assessmentEngines: UvmAssessmentEngineId[]
    assessmentScanId: string
    assessmentNmapProfile: NetworkScanProfile
    assessmentMode: UvmAssessmentMode
}) {
    const attentionFindings = data.findings.filter(finding => !['resolved', 'false_positive', 'accepted_risk'].includes(finding.status))
    const actionableFindingCount = data.findingSummary?.actionable ?? attentionFindings.filter(finding => finding.status !== 'needs_review').length
    const needsReviewFindingCount = data.findingSummary?.needsReview ?? attentionFindings.filter(finding => finding.status === 'needs_review').length
    const attentionFindingCount = findingScope ? actionableFindingCount + needsReviewFindingCount
        : data.findingGroupSummary ? data.findingGroupSummary.actionable + data.findingGroupSummary.needsReview : actionableFindingCount + needsReviewFindingCount
    const findingGroups: UvmFindingGroup[] = data.findingGroups ?? data.findings.map(finding => ({
        id: `finding:${finding.id}`, correlated: false, assetId: finding.assetId, asset: finding.asset, address: finding.address,
        affectedLocation: finding.affectedLocation || null, cveIds: finding.cveIds, engines: [finding.engine], severity: finding.severity,
        status: ['open', 'in_progress', 'pending_verification'].includes(finding.status) ? 'actionable'
            : finding.status === 'needs_review' ? 'needs_review'
                : finding.status === 'resolved' ? 'resolved'
                    : finding.status === 'accepted_risk' ? 'accepted_risk'
                        : finding.status === 'false_positive' ? 'false_positive' : 'mixed',
        members: [finding],
    }))
    const selectableAssessmentEngines = assessmentEngines.filter(engine => {
        const info = data.engines.find(item => item.id === engine)
        return !servicesPaused && info?.status === 'available' && (engine !== 'tenable-vm' || (data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled)))
    })
    return {
        dashboardUnavailable: servicesPaused || Boolean(data.scannerError),
        activeRuns: data.runs.filter(run => ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status)),
        activeAssessments: data.assessments.some(assessment => ['queued', 'running', 'cancelling'].includes(assessment.status)),
        attentionFindings,
        actionableFindingCount,
        needsReviewFindingCount,
        attentionFindingCount,
        criticalOrHighFindingCount: data.findingSummary?.criticalOrHigh ?? attentionFindings.filter(finding => finding.severity === 'critical' || finding.severity === 'high').length,
        visibleFindings: filterAndSortUvmFindings(data.findings, findingFilters, data.assets, findingSort),
        visibleFindingGroups: filterAndSortUvmFindingGroups(findingGroups, findingFilters, data.assets, findingSort),
        selectableAssessmentEngines,
        automaticPrerequisitesAvailable: !servicesPaused
            && ['nmap', 'httpx'].every(id => data.engines.some(engine => engine.id === id && engine.status === 'available'))
            && selectableAssessmentEngines.some(engine => engine === 'tenable-vm' || engine === 'gvm'),
        plannedEngineCount: buildUvmAssessmentEnginePlan(selectableAssessmentEngines, assessmentScanId, assessmentNmapProfile, assessmentMode).length,
    }
}
