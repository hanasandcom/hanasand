import type { UvmDashboard } from '@/utils/monitoring/types'

export function mergeUvmDashboardRefresh(current: UvmDashboard, refreshed: UvmDashboard, preserveFindingHistory = false): UvmDashboard {
    const refreshedIds = new Set(refreshed.findings.map(finding => finding.id))
    return {
        ...refreshed,
        findings: [...refreshed.findings, ...current.findings.filter(finding => !refreshedIds.has(finding.id))],
        findingsNextCursor: preserveFindingHistory ? current.findingsNextCursor : refreshed.findingsNextCursor,
    }
}
