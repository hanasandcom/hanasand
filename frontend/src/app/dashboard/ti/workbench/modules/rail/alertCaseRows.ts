import type { AlertDetailState, CaseDetailState, OperatorActionRailRow, WorkbenchCase, WorkbenchOrgContext } from '../../types'
import { alertSourceProfileHref, caseCustomerNotificationHref, caseExportHref, customerNotificationActionState } from '../caseRoutes'
import { caseDetailHrefFromAlertDetail } from '../actionInputs'
import { relatedLinkHref } from '../handoffRows'

const alertWorkflowActionIds = new Set(['review_alert', 'escalate_alert', 'suppress_alert', 'close_alert'])

export function alertCaseRows(selected: WorkbenchCase, orgContext?: WorkbenchOrgContext, caseDetail?: CaseDetailState, alertDetail?: AlertDetailState, note = ''): OperatorActionRailRow[] {
    const rows: OperatorActionRailRow[] = []
    if (selected.kind === 'dwm_alert') {
        const alertDetailHref = `/api/findings/alerts/${encodeURIComponent(selected.id)}`
        const dwmWorkspaceHref = relatedLinkHref(selected, 'Open dark web case') || `/findings?alert=${encodeURIComponent(selected.id)}`
        rows.push({
            id: 'open_dwm_workspace',
            label: 'Open dark web case',
            detail: 'Open the selected alert with evidence decisions, source details, delivery state, and case activity.',
            tone: selected.persistent ? 'ready' : 'needs_action',
            href: dwmWorkspaceHref,
        })
        rows.push({
            id: 'open_alert_detail',
            label: 'Open alert detail',
            detail: selected.persistent ? `Open ${alertDetailHref}.` : 'Fallback alerts cannot load /api/findings/alerts/:id.',
            tone: selected.persistent ? 'ready' : 'blocked',
            href: selected.persistent ? alertDetailHref : undefined,
            disabledReason: selected.persistent ? undefined : 'Fallback alerts cannot load /api/findings/alerts/:id.',
        })
        const sourceProfileHref = alertSourceProfileHref(alertDetail?.status === 'ready' ? alertDetail.detail : undefined)
        if (sourceProfileHref) {
            rows.push({
                id: 'inspect_alert_source_health',
                label: 'Source health',
                detail: `Open source inventory profile from alert evidence: ${sourceProfileHref}.`,
                tone: 'ready',
                href: sourceProfileHref,
            })
        }
    }
    const backedCaseHref = selected.caseDetailHref || (alertDetail?.status === 'ready' ? caseDetailHrefFromAlertDetail(alertDetail.detail, orgContext) : undefined)
    if (backedCaseHref) {
        rows.push({ id: 'open_case', label: 'Open selected case', detail: backedCaseHref, tone: 'ready', href: backedCaseHref })
        rows.push({
            id: 'export_case_evidence',
            label: 'Case package',
            detail: `Open ${caseExportHref(backedCaseHref)} for evidence, timeline, delivery rows, and next actions.`,
            tone: 'ready',
            href: caseExportHref(backedCaseHref),
        })
        const notificationState = customerNotificationActionState(caseDetail)
        const notificationDisabledReason = notificationState.disabledReason || (!note.trim() ? 'Customer notification needs decision rationale.' : undefined)
        rows.push({
            id: 'record_customer_notification',
            label: 'Record notification',
            detail: `POST ${caseCustomerNotificationHref(backedCaseHref)} after delivered webhook evidence is present.`,
            tone: notificationDisabledReason ? 'blocked' : 'ready',
            customerNotification: true,
            disabledReason: notificationDisabledReason,
        })
    } else if (selected.kind === 'dwm_alert') {
        const openCaseAction = selected.actions?.find(action => action.id === 'open_case')
        rows.push({
            id: 'open_case',
            label: 'Open selected case',
            detail: openCaseAction ? 'Create or reuse a case from this alert while preserving evidence, watchlist scope, and delivery context.' : selected.missingDependency || 'Case link is syncing to this alert.',
            tone: openCaseAction ? 'ready' : 'blocked',
            action: openCaseAction,
            disabledReason: openCaseAction ? undefined : 'case delivery action is not attached to this alert yet.',
        })
    }
    if (selected.kind === 'dwm_alert') {
        const replayAction = selected.actions?.find(action => action.id === 'replay_alert')
        const replayDisabledReason = replayAction?.disabledReason || (selected.persistent ? undefined : 'Persisted alert replay is syncing before evidence replay can run.')
        rows.push({
            id: 'replay_alert',
            label: 'Replay evidence',
            detail: replayDisabledReason
                ? replayDisabledReason
                : replayAction ? `${replayAction.method} ${replayAction.href}; replay is available for this workflow version.` : `Replay evidence for ${selected.id}.`,
            tone: replayDisabledReason ? 'blocked' : 'ready',
            action: replayAction || {
                id: 'replay_alert',
                label: 'Replay',
                method: 'POST',
                href: `/api/findings/alerts/${encodeURIComponent(selected.id)}/replay`,
                body: { actor: 'dashboard' },
                disabledReason: selected.persistent ? undefined : 'Persisted alert replay has not attached yet.',
            },
            disabledReason: replayDisabledReason,
        })
        for (const action of selected.actions?.filter(candidate => alertWorkflowActionIds.has(candidate.id)) || []) {
            rows.push({
                id: action.id,
                label: action.label,
                detail: `${action.method} ${action.href}; rationale is attached before the workflow state is updated.`,
                tone: action.disabledReason ? 'blocked' : 'ready',
                action,
                disabledReason: action.disabledReason,
            })
        }
    }
    return rows
}
