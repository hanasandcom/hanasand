import type { CaseAction, CaseDetail } from './contracts'
import type { DeliveryRow, EvidenceRow } from './evidenceTypes'
import { safeEvidenceExcerpt } from '@/utils/dwm/display'
import { DWM_CASE_REPORT_MAX_EVIDENCE } from './constants'

export function safeCaseEvidenceExcerpt(row: EvidenceRow) {
    return safeEvidenceExcerpt(row.safeExcerpt || row.excerpt || 'No safe excerpt available.')
}

export function toggleSelectedEvidence(selected: string[], evidenceId: string) {
    return selected.includes(evidenceId) ? selected.filter(id => id !== evidenceId) : [...selected, evidenceId].slice(0, DWM_CASE_REPORT_MAX_EVIDENCE)
}

export function thirdPartyReportHref(caseId: string, tenantId: string, organizationId: string | undefined, alertId: string | undefined, evidenceIds: string[], format: 'json' | 'stix') {
    const params = new URLSearchParams({ tenantId, report: 'true', format })
    if (organizationId) params.set('organizationId', organizationId)
    if (alertId) params.set('alertId', alertId)
    for (const evidenceId of evidenceIds) params.append('evidenceId', evidenceId)
    return `/api/cases/${encodeURIComponent(caseId)}/export?${params.toString()}`
}

export function queryString(params: Record<string, string | undefined>) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
    const rendered = query.toString()
    return rendered ? `?${rendered}` : ''
}

export function matchedTerms(detail: CaseDetail) {
    const terms = detail.watchlists?.flatMap(watchlist => watchlist.matchedTerms?.map(term => term.value).filter(Boolean) || []) || []
    return uniqueStrings([detail.alert?.matchedTerm?.value, ...terms])
}

export function resolvedTenantId(caseRecord: CaseDetail['case'] | undefined, fallback: string) {
    return caseRecord?.tenantId || fallback
}

export function resolvedOrganizationId(caseRecord: CaseDetail['case'] | undefined, fallback?: string) {
    return caseRecord?.organizationId || fallback
}

export function resolvedAlertId(caseRecord: CaseDetail['case'] | undefined, alertContext: CaseDetail['alertContext'] | undefined, fallback?: string) {
    return caseRecord?.alertId || alertContext?.id || fallback
}

export function uniqueStrings(values: Array<string | undefined>) {
    return [...new Set(values.map(value => value?.trim()).filter(Boolean) as string[])]
}

export function actionUnavailableReasons(actions: CaseAction[], readOnly: boolean) {
    if (readOnly) return [{ id: 'access', reason: 'Your current role can inspect this case but cannot change workflow state.' }]
    return actions.filter(action => !action.enabled).map(action => ({
        id: action.id,
        reason: action.disabledReason || 'Action is not available for this case.',
    }))
}

export function relativeTime(value?: string) {
    if (!value) return 'time pending'
    const time = new Date(value).getTime()
    if (!Number.isFinite(time)) return value
    const diff = Date.now() - time
    const abs = Math.abs(diff)
    const units: Array<[number, string]> = [[86_400_000, 'd'], [3_600_000, 'h'], [60_000, 'm']]
    for (const [size, label] of units) if (abs >= size) return `${Math.round(diff / size)}${label} ago`
    return 'just now'
}

export function stateLabel(value?: string) {
    return (value || 'pending').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

export function compactCaseReference(value: string | undefined, label: string) {
    if (!value) return undefined
    const cleaned = value.trim()
    const normalized = cleaned.replace(/^(?:dwm[_:-]+)?(?:case|alert|org|organization|tenant)[_:-]+/i, '')
    const compact = normalized.length > 18 ? normalized.slice(-14).replace(/^[:_-]+/, '') : normalized
    return `${label} ${compact || cleaned}`
}

export function evidenceReferenceState(row: EvidenceRow) {
    return row.provenance?.captureId || row.id ? 'capture linked' : 'capture pending'
}

export function sourceReferenceState(row: EvidenceRow) {
    return row.provenance?.sourceId ? 'source linked' : 'source pending'
}

export function evidenceHashState(row: EvidenceRow) {
    return row.contentHash || row.provenance?.contentHash ? 'hash linked' : 'hash pending'
}

export function deliveryDestinationState(row: DeliveryRow) {
    if (row.endpointHint || row.endpointHash) return 'configured destination'
    if (row.webhookDestinationId || row.destinationId) return 'saved destination'
    return 'destination pending'
}

export function deliveryRetryBlockedReason(row?: DeliveryRow) {
    if (row?.status !== 'failed' || row.retryable !== true || !row.nextRetryAt) return undefined
    const dueAt = Date.parse(row.nextRetryAt)
    return Number.isFinite(dueAt) && dueAt > Date.now()
        ? `Exact report retry is available at ${new Date(dueAt).toLocaleString()}.`
        : undefined
}

export function webhookActionBlockedReason(detail: CaseDetail | null | undefined, alertId?: string) {
    if (!alertId) return 'Webhook delivery needs a linked alert before it can be tested or sent.'
    if (detail?.customerNotificationContext?.ready === false) {
        const blockers = uniqueStrings(detail.customerNotificationContext.blockers ?? [])
        return blockers.length ? blockers.map(stateLabel).join(', ') : 'Webhook delivery needs an active customer destination before it can be tested or sent.'
    }
    return undefined
}

export function timelineActorLabel(value?: string) {
    return value || 'system'
}

export function actionLabel(value: string) {
    if (value === 'confirm_resolution') return 'Confirm resolution'
    if (value === 'start_progress') return 'Start progress'
    if (value === 'false_positive') return 'False positive'
    return stateLabel(value)
}
