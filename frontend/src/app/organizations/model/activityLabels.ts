import type { ActivitySubjectType, ActivityItem } from '../types/activity'
import type { OrganizationSummary } from '../types/organization'
import type { OrgBundle } from '../types/bundle'
import { stateLabel, objectValue } from './labels'
import { ORG_ACTIVITY_PREVIEW_ROWS } from '../constants/activity'

export function activitySubjectTypeLabel(value: ActivitySubjectType) {
    if (value === 'organization') return 'Organization'
    if (value === 'destination') return 'Delivery destination'
    return stateLabel(value)
}

export function activitySourceLabel(item: ActivityItem) {
    return item.source === 'session' ? 'This session' : 'Saved history'
}

export function trimActivityRows(rows: ActivityItem[]) {
    const counts = new Map<string, number>()
    return rows.filter(item => {
        const key = item.organizationId || 'workspace'
        const count = counts.get(key) || 0
        if (count >= ORG_ACTIVITY_PREVIEW_ROWS) return false
        counts.set(key, count + 1)
        return true
    })
}

export function organizationLastActivityAt(organization: OrganizationSummary, bundle: OrgBundle) {
    const timestamps = [
        organization.updatedAt,
        ...bundle.members.map(member => member.joinedAt),
        ...bundle.invites.map(invite => invite.createdAt),
        ...bundle.watchlists.flatMap(item => [item.updatedAt, item.archivedAt || undefined, item.createdAt]),
        ...bundle.webhooks.flatMap(destination => [destination.updatedAt, destination.createdAt]),
        ...bundle.alerts.map(alert => alert.updatedAt),
        ...bundle.cases.map(item => item.updatedAt),
        ...bundle.deliveries.flatMap(delivery => [delivery.attemptedAt, delivery.updatedAt, delivery.createdAt]),
    ]
        .filter((value): value is string => Boolean(value))
        .map(value => ({ value, time: Date.parse(value) }))
        .filter(item => Number.isFinite(item.time))
        .sort((left, right) => right.time - left.time)

    return timestamps[0]?.value
}

export function visibilityRows(payload: Record<string, unknown> | null) {
    if (!payload) return []
    const visibility = objectValue(payload.visibility) || objectValue(payload.alertCaseVisibility) || objectValue(payload.caseVisibility)
    const rows = [
        ['Event visibility', visibility?.alertReadAllowed ?? visibility?.allowed ?? payload.allowed],
        ['Case assignment', visibility?.caseAssignmentAllowed ?? visibility?.canAssignCase],
        ['Case link', visibility?.caseRoute ?? payload.caseRoute ?? '/api/cases'],
    ]
    return rows.map(([label, value]) => ({
        id: String(label),
        primary: String(label),
        secondary: value === undefined || value === null ? 'Not available' : String(value),
    }))
}
