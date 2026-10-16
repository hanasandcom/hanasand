import type { OrganizationLoadError } from '../types/organization'
import type { ScopedCase } from '../types/activity'
import { sanitizeOrganizationDisplayCopy } from './textSafety'

export function organizationRoleLabel(role: string) {
    return sentenceCase(role === 'member' || role === 'viewer' ? 'reader' : role)
}

export function organizationLoadErrorsForDisplay(errors: OrganizationLoadError[]) {
    const firstUnavailableIndex = errors.findIndex(error => error.serviceUnavailable)
    return errors.filter((error, index) => !error.serviceUnavailable || index === firstUnavailableIndex)
}

export function organizationMonitoringCaseId(cases: ScopedCase[]) {
    const terminalStatuses = new Set(['closed', 'resolved', 'false_positive', 'suppressed'])
    return cases.find(item => /^HA-[1-9]\d*$/.test(item.id) && !terminalStatuses.has((item.status || 'open').toLowerCase()))?.id
}

export function organizationLoadErrorLabel(endpoint: string) {
    if (endpoint === 'events') return 'Events'
    if (endpoint === 'alertTerms') return 'Watchlist terms'
    if (endpoint === 'alertCaseVisibility') return 'Event visibility'
    return readableEndpoint(endpoint)
}

export function isServerUnavailable(error: unknown) {
    return Boolean(error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' && error.status >= 500)
}

export function apiErrorMessage(payload: unknown, status: number) {
    const record = objectValue(payload)
    const error = objectValue(record?.error)
    if (typeof record?.error === 'string') return record.error
    if (typeof error?.message === 'string') return error.message
    if (typeof record?.message === 'string') return record.message
    return `Request failed with HTTP ${status}.`
}

export function errorMessage(error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'dwm_watchlist_sync_failed' && error instanceof Error) {
        return error.message
    }
    if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        return 'Your session has expired. Sign in again.'
    }
    if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' && error.status >= 500) {
        return 'Organization service is temporarily unavailable.'
    }
    return error instanceof Error ? error.message : String(error)
}

export function endpointErrorMessage(error: unknown) {
    const message = errorMessage(error)
    if (/route not found|not_found|404/i.test(message)) return 'Action unavailable'
    return sanitizeOrganizationDisplayCopy(message) || message
}

export function objectValue(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function arrayValue<T>(value: unknown): T[] {
    return Array.isArray(value) ? value as T[] : []
}

export function alertGenerationReference(value: unknown) {
    const direct = cleanString(value)
    if (direct) return direct
    const reference = objectValue(value)
    const dedupe = objectValue(reference?.dedupe)
    return cleanString(dedupe?.key)
        || cleanString(reference?.watchlistItemId)
        || cleanString(reference?.itemId)
        || cleanString(reference?.term)
}

export function normalizeAlertGenerationRecords<T extends { alertGenerationRef?: string }>(value: unknown): T[] {
    return arrayValue<Record<string, unknown>>(value).map(record => ({
        ...record,
        alertGenerationRef: alertGenerationReference(record.alertGenerationRef),
    }) as T)
}

export function cleanString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function numberValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function booleanValue(value: unknown) {
    return typeof value === 'boolean' ? value : undefined
}

export function readableEndpoint(value: string) {
    return value.replace(/([A-Z])/g, ' $1').toLowerCase()
}

export function sentenceCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

export function actionLabel(value: string) {
    return value.split('-').map(sentenceCase).join(' ')
}

export function stateLabel(value: string) {
    return value.split(/[-_]+/).filter(Boolean).map(sentenceCase).join(' ')
}

export function inviteBusyLabel(value: string) {
    if (value === 'send-invite') return 'Sending invites'
    if (value === 'resend-invite') return 'Resending invite'
    if (value === 'revoke-invite') return 'Revoking invite'
    if (value === 'copy-invite') return 'Copying invite'
    return ''
}

export function memberBusyLabel(value: string) {
    if (value === 'change-role') return 'Updating member role'
    if (value === 'remove-member') return 'Removing member'
    return ''
}

export function watchlistBusyLabel(value: string) {
    if (value === 'create-watchlist') return 'Adding watchlist term'
    if (value === 'save-watchlist') return 'Saving watchlist term'
    if (value === 'pause-watchlist') return 'Pausing watchlist term'
    if (value === 'resume-watchlist') return 'Resuming watchlist term'
    if (value === 'archive-watchlist') return 'Archiving watchlist term'
    if (value === 'restore-watchlist') return 'Restoring watchlist term'
    if (value === 'delete-watchlist') return 'Archiving watchlist term'
    if (value === 'cleanup-watchlists') return 'Cleaning archived watchlists'
    if (value === 'save-destination') return 'Testing watchlist destination'
    if (value === 'replay-destination') return 'Replaying saved destination'
    return ''
}

export function formatDate(value: string | undefined) {
    if (!value) return ''
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    } catch {
        return value
    }
}
