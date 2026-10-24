import type { UvmAsset, UvmAssetCriticality, UvmFinding, UvmFindingGroup } from '@/utils/monitoring/types'

export type UvmFindingFilters = { query: string, engine: string, severity: string, status: string, asset: string }
export type UvmFindingSort = 'severity' | 'criticality' | 'due-date'

function compareRemediationDates(left?: string | null, right?: string | null) {
    const leftDate = left && /^\d{4}-\d{2}-\d{2}$/.test(left) ? left : null
    const rightDate = right && /^\d{4}-\d{2}-\d{2}$/.test(right) ? right : null
    if (leftDate && rightDate) return leftDate.localeCompare(rightDate)
    return leftDate ? -1 : rightDate ? 1 : 0
}

const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, unknown: 5 }
const criticalityRank: Record<UvmAssetCriticality, number> = { critical: 0, high: 1, medium: 2, low: 3, unset: 4 }
const statusRank: Record<UvmFinding['status'], number> = { needs_review: 0, open: 1, in_progress: 2, pending_verification: 3, accepted_risk: 4, false_positive: 5, resolved: 6 }
const groupStatusRank: Record<UvmFindingGroup['status'], number> = { actionable: 0, needs_review: 1, mixed: 2, accepted_risk: 3, false_positive: 4, resolved: 5 }

function compareFindingAge(left: UvmFinding, right: UvmFinding) {
    const leftAge = Date.parse(left.firstSeen || left.lastSeen || left.updatedAt) || Number.MAX_SAFE_INTEGER
    const rightAge = Date.parse(right.firstSeen || right.lastSeen || right.updatedAt) || Number.MAX_SAFE_INTEGER
    return leftAge - rightAge
}

export function filterAndSortUvmFindings(findings: UvmFinding[], filters: UvmFindingFilters, assets: UvmAsset[] = [], sort: UvmFindingSort = 'severity') {
    const query = filters.query.trim().toLowerCase()
    const filtered = findings.filter(finding => {
        if (query && ![finding.title, finding.asset, finding.address || '', finding.externalId, finding.engine,
            finding.description || '', ...finding.cveIds].join(' ').toLowerCase().includes(query)) return false
        if (filters.engine !== 'all' && finding.engine !== filters.engine) return false
        if (filters.severity !== 'all' && finding.severity !== filters.severity) return false
        if (filters.status === 'needs_attention' && !['needs_review', 'open', 'in_progress', 'pending_verification'].includes(finding.status)) return false
        if (filters.status === 'actionable' && !['open', 'in_progress', 'pending_verification'].includes(finding.status)) return false
        if (!['all', 'actionable', 'needs_attention'].includes(filters.status) && finding.status !== filters.status) return false
        const assetKey = finding.assetId || finding.asset
        return filters.asset === 'all' || assetKey === filters.asset
    })
    const assetCriticality = new Map(assets.map(asset => [asset.id, asset.criticality]))
    return filtered.sort((left, right) => {
        if (sort === 'due-date') {
            const dueDateDifference = compareRemediationDates(left.remediationDueDate, right.remediationDueDate)
            if (dueDateDifference) return dueDateDifference
        }
        if (sort === 'criticality') {
            const leftCriticality = left.assetId ? assetCriticality.get(left.assetId) || 'unset' : 'unset'
            const rightCriticality = right.assetId ? assetCriticality.get(right.assetId) || 'unset' : 'unset'
            const criticalityDifference = criticalityRank[leftCriticality] - criticalityRank[rightCriticality]
            if (criticalityDifference) return criticalityDifference
        }
        return (severityRank[left.severity] ?? 5) - (severityRank[right.severity] ?? 5)
            || statusRank[left.status] - statusRank[right.status] || compareFindingAge(left, right) || left.title.localeCompare(right.title)
    })
}

export function filterAndSortUvmFindingGroups(groups: UvmFindingGroup[], filters: UvmFindingFilters, assets: UvmAsset[] = [], sort: UvmFindingSort = 'severity') {
    const matchingGroups = groups.map(group => ({ group, members: filterAndSortUvmFindings(group.members, filters, assets, sort) }))
        .filter(({ members }) => members.length > 0)
    const assetCriticality = new Map(assets.map(asset => [asset.id, asset.criticality]))
    return matchingGroups.sort(({ group: left, members: leftMembers }, { group: right, members: rightMembers }) => {
        if (sort === 'due-date') {
            const leftDueDate = leftMembers[0]?.remediationDueDate
            const rightDueDate = rightMembers[0]?.remediationDueDate
            const dueDateDifference = compareRemediationDates(leftDueDate, rightDueDate)
            if (dueDateDifference) return dueDateDifference
        }
        if (sort === 'criticality') {
            const leftCriticality = left.assetId ? assetCriticality.get(left.assetId) || 'unset' : 'unset'
            const rightCriticality = right.assetId ? assetCriticality.get(right.assetId) || 'unset' : 'unset'
            const criticalityDifference = criticalityRank[leftCriticality] - criticalityRank[rightCriticality]
            if (criticalityDifference) return criticalityDifference
        }
        const severityDifference = (severityRank[left.severity] ?? 5) - (severityRank[right.severity] ?? 5)
        if (severityDifference) return severityDifference
        const statusDifference = groupStatusRank[left.status] - groupStatusRank[right.status]
        if (statusDifference) return statusDifference
        if (sort === 'due-date') {
            const leftFirstSeen = Math.min(...leftMembers.map(finding => Date.parse(finding.firstSeen || finding.lastSeen || finding.updatedAt) || Number.MAX_SAFE_INTEGER))
            const rightFirstSeen = Math.min(...rightMembers.map(finding => Date.parse(finding.firstSeen || finding.lastSeen || finding.updatedAt) || Number.MAX_SAFE_INTEGER))
            if (leftFirstSeen !== rightFirstSeen) return leftFirstSeen - rightFirstSeen
        }
        return left.asset.localeCompare(right.asset) || left.id.localeCompare(right.id)
    }).map(({ group }) => group)
}
