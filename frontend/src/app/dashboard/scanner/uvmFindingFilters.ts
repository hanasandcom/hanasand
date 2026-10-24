import type { UvmFinding } from '@/utils/monitoring/types'

export type UvmFindingFilters = { query: string, engine: string, severity: string, status: string, asset: string }

export function filterAndSortUvmFindings(findings: UvmFinding[], filters: UvmFindingFilters) {
    const query = filters.query.trim().toLowerCase()
    const filtered = findings.filter(finding => {
        if (query && ![
            finding.title, finding.asset, finding.address || '', finding.externalId, finding.engine,
            finding.description || '', ...finding.cveIds,
        ].join(' ').toLowerCase().includes(query)) return false
        if (filters.engine !== 'all' && finding.engine !== filters.engine) return false
        if (filters.severity !== 'all' && finding.severity !== filters.severity) return false
        if (filters.status === 'actionable' && (!['open', 'in_progress', 'pending_verification'].includes(finding.status) || finding.severity === 'info')) return false
        if (!['all', 'actionable'].includes(filters.status) && finding.status !== filters.status) return false
        const assetKey = finding.assetId || finding.asset
        return filters.asset === 'all' || assetKey === filters.asset
    })
    const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, unknown: 5 }
    const statusRank: Record<UvmFinding['status'], number> = { open: 0, in_progress: 1, pending_verification: 2, accepted_risk: 3, false_positive: 4, resolved: 5 }
    return filtered.sort((left, right) => {
        const severityDifference = (severityRank[left.severity] ?? 5) - (severityRank[right.severity] ?? 5)
        if (severityDifference) return severityDifference
        const statusDifference = statusRank[left.status] - statusRank[right.status]
        if (statusDifference) return statusDifference
        const leftAge = Date.parse(left.firstSeen || left.lastSeen || left.updatedAt) || Number.MAX_SAFE_INTEGER
        const rightAge = Date.parse(right.firstSeen || right.lastSeen || right.updatedAt) || Number.MAX_SAFE_INTEGER
        return leftAge - rightAge || left.title.localeCompare(right.title)
    })
}
