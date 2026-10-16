import type { WorkbenchCase, WorkbenchOrgContext, CaseDetailState, WorkbenchApiPayload, WorkbenchAction, AlertDetailPayload } from '../types'
import { hasSendDeliveryDestination } from './caseRoutes'
import { stringValue, scopeBody } from './actionMessages'

export function sendDeliveryActionFor(item: WorkbenchCase) {
    return item.actions?.find(candidate => candidate.id === 'send_alert') || (item.kind === 'dwm_alert' ? {
        id: 'send_alert',
        label: 'Send',
        method: 'POST' as const,
        href: '/api/findings/webhooks/deliver',
        body: { alertId: item.id, limit: 1 },
        disabledReason: item.persistent ? undefined : 'Persisted alert delivery is syncing before webhook send can run.',
    } : undefined)
}

export function sendDeliveryDisabledReason(item: WorkbenchCase, orgContext: WorkbenchOrgContext | undefined) {
    if (item.kind !== 'dwm_alert') return undefined
    if (!item.persistent) return 'Send requires a persistent alert and webhook delivery route.'
    const action = sendDeliveryActionFor(item)
    if (action?.disabledReason) return action.disabledReason
    if (!hasSendDeliveryDestination(action, orgContext)) return 'Send delivery requires an active organization webhook destination or action-scoped webhook target.'
    return undefined
}

export function orgInviteDisabledReason(orgContext: WorkbenchOrgContext | undefined, caseDetail: CaseDetailState | undefined) {
    if (!orgContext?.organization) return 'Select an organization before inviting a teammate.'
    const access = caseDetail?.status === 'ready' ? caseDetail.detail.access : undefined
    if (access?.readOnly === true || access?.visibilityDecision?.allowed === false) return 'Invite is disabled because the case API marked this member read-only or visibility-blocked.'
    return ''
}

export function watchlistMutationDisabledReason(orgContext: WorkbenchOrgContext | undefined, caseDetail: CaseDetailState | undefined) {
    if (!orgContext?.createWatchlistAction) return orgContext?.readiness.blockedReasons[0] || 'Connect the organization watchlist service before saving shared terms.'
    const access = caseDetail?.status === 'ready' ? caseDetail.detail.access : undefined
    if (access?.readOnly === true || access?.visibilityDecision?.allowed === false) return 'Watchlist update is disabled because the case API marked this member read-only or visibility-blocked.'
    return ''
}

export function caseDetailHrefFromPayload(payload: WorkbenchApiPayload | undefined, action: WorkbenchAction | undefined, orgContext: WorkbenchOrgContext | undefined) {
    const caseId = payload?.case?.id
    if (!caseId) return undefined
    const organizationId = payload.case?.organizationId
        || stringValue(action?.body?.organizationId)
        || orgContext?.organization?.id
        || orgContext?.scope.organizationId
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
    return `/api/cases/${encodeURIComponent(caseId)}${query}`
}

export function caseDetailHrefFromAlertDetail(payload: AlertDetailPayload | undefined, orgContext: WorkbenchOrgContext | undefined) {
    const alert = payload?.alert
    const caseId = stringValue(alert?.caseId) || stringValue(alert?.caseIdCandidate) || stringValue(alert?.workflowContext?.caseIdCandidate)
    if (!caseId) return undefined
    const organizationId = stringValue(alert?.organizationId)
        || stringValue(alert?.workflowContext?.organizationId)
        || orgContext?.organization?.id
        || orgContext?.scope.organizationId
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
    return `/api/cases/${encodeURIComponent(caseId)}${query}`
}

export function alertWorkflowMutationBody(item: WorkbenchCase, detail: AlertDetailPayload | undefined, orgContext: WorkbenchOrgContext | undefined) {
    const alert = detail?.alert
    const contract = detail?.analystWorkflowContract
    const organizationId = stringValue(alert?.organizationId)
        || stringValue(alert?.workflowContext?.organizationId)
        || orgContext?.organization?.id
        || orgContext?.scope.organizationId
    const expectedWorkflowEventCount = detail?.workflowExecutionReadiness?.currentWorkflowEventCount
        ?? contract?.idempotency?.workflowEventCount
    const expectedUpdatedAt = detail?.workflowExecutionReadiness?.currentUpdatedAt
        || contract?.idempotency?.updatedAt
        || alert?.updatedAt
    return {
        ...(organizationId ? { organizationId } : scopeBody(orgContext)),
        alertId: item.id,
        ...(expectedWorkflowEventCount !== undefined ? { expectedWorkflowEventCount } : {}),
        ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
    }
}

export function scopedActionBody(body: Record<string, unknown>, orgContext: WorkbenchOrgContext | undefined): Record<string, unknown> {
    return {
        ...scopeBody(orgContext),
        ...body,
    }
}

export function scopedDeliveryActionBody(body: Record<string, unknown>, orgContext: WorkbenchOrgContext | undefined): Record<string, unknown> {
    const scoped = scopedActionBody(body, orgContext)
    const activeWebhook = orgContext?.webhookDestinations.find(item => item.status === 'active')
    if (!stringValue(scoped.webhookDestinationId) && !stringValue(scoped.webhookUrl) && activeWebhook?.id) {
        return { ...scoped, webhookDestinationId: activeWebhook.id }
    }
    return scoped
}
