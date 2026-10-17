import type { CaseEvent, CheckDetails } from './case-events'
import type { CaseRow } from './caseTypes'

export type MonitoringCase = CaseRow & {
    diskDiagnostics?: { sampledAt: string, host: string, filesystems: Array<{ path: string, usedPercent: number, complete: boolean, directories: Array<{ path: string, sizeBytes: number }> }> },
    canManage?: boolean,
    relatedChecks?: Array<{ id: string, name: string, message: string, outcome?: string, completedAt?: string }>,
    events?: CaseEvent[], eventTotal?: number, eventPage?: number, eventSnapshot?: string, currentCheck?: CheckDetails,
    lastSeenAt?: string, occurrences: number, automationId: string, resolvedAt?: string, notificationsEnabled: boolean,
    history: Array<{ id: string, actor: string, at: string, action: string, note?: string, fromStatus?: string, toStatus?: string, fromSeverity?: string, toSeverity?: string, notificationsEnabled?: boolean }>,
    comments: Array<{ id: string, author: string, body: string, createdAt: string, actorType?: 'human' | 'automation' }>,
    notifications: Array<{ messageId?: string, deliveredAt?: string, error?: string, nextAttemptAt?: string, message?: { content?: string, embeds?: Array<{ title?: string, description?: string, fields?: Array<{ name: string, value: string }> }> } }>,
}

export const caseTabs = ['overview', 'history', 'events', 'settings'] as const
export type CaseTab = typeof caseTabs[number]

export function caseEndpoint(caseId: string, organizationId?: string) {
    const params = new URLSearchParams(organizationId ? { organizationId } : {})
    return `/api/cases/${encodeURIComponent(caseId)}?${params}`
}

export function mergeCaseEvents(current: MonitoringCase, next: MonitoringCase) {
    const events = [...new Map([...(current.events || []), ...(next.events || [])].map(event => [event.id, event])).values()]
    return { ...current, events, eventPage: next.eventPage, eventTotal: next.eventTotal }
}
