import type { AlertDetailState, CaseDetailState, OperatorActionRailRow, WorkbenchAction, WorkbenchCase, WorkbenchDeliveryEvidence, WorkbenchOrgContext } from '../../types'
import { relatedLinkHref } from '../handoffRows'
import { handoffActionRailRows } from '../handoffRows'
import { alertCaseRows } from './alertCaseRows'
import { deliveryRows } from './deliveryRows'
import { readinessRows } from './readinessRows'

function sourceRows(selected: WorkbenchCase): OperatorActionRailRow[] {
    const rows: OperatorActionRailRow[] = []
    if (selected.kind === 'source_capture') {
        const sourceHref = relatedLinkHref(selected, 'Open source')
        rows.push({
            id: 'open_capture_source',
            label: 'Open source',
            detail: sourceHref ? `${selected.sourceLabel} via ${sourceHref}.` : 'Selected evidence did not include a source profile link.',
            tone: sourceHref ? 'ready' : 'blocked',
            href: sourceHref,
            disabledReason: sourceHref ? undefined : 'Source capture drill-in requires /ti/sources/:id.',
        })
    }
    if (selected.kind === 'ti_domain') {
        const sourcesHref = relatedLinkHref(selected, 'Review sources')
        rows.push({
            id: 'review_domain_sources',
            label: 'Review sources',
            detail: sourcesHref ? `${selected.sourceLabel} via ${sourcesHref}.` : 'Selected domain item did not include a source review link.',
            tone: sourcesHref ? 'ready' : 'blocked',
            href: sourcesHref,
            disabledReason: sourcesHref ? undefined : 'Source review requires /ti/admin/sources.',
        })
    }
    return rows
}

export function actionRailRows(selected: WorkbenchCase | undefined, orgContext: WorkbenchOrgContext | undefined, caseDetail?: CaseDetailState, alertDetail?: AlertDetailState, actionDeliveries: WorkbenchDeliveryEvidence[] = [], note = ''): OperatorActionRailRow[] {
    if (!selected) return [{ id: 'select_case', label: 'Select work', detail: 'Choose a case before actions are available.', tone: 'needs_action' }]
    if (selected.handoff) return handoffActionRailRows(selected, orgContext)
    const rows = [
        ...alertCaseRows(selected, orgContext, caseDetail, alertDetail, note),
        ...sourceRows(selected),
        ...deliveryRows(selected, orgContext, caseDetail, alertDetail, actionDeliveries),
        ...readinessRows(selected, orgContext),
    ]
    const handledActionIds = new Set(rows.flatMap(row => [row.id, row.action?.id].filter(Boolean) as string[]))
    for (const action of selected.actions || []) {
        if (handledActionIds.has(action.id) || action.id === 'rebuild_alerts') continue
        rows.push({
            id: action.id, label: action.label, detail: `${action.method} ${action.href}.`,
            tone: action.disabledReason ? 'blocked' : 'ready',
            href: action.method === 'GET' ? action.href : undefined,
            action: action.method === 'GET' ? undefined : action,
            disabledReason: action.disabledReason,
        })
        handledActionIds.add(action.id)
    }
    const rebuildAction = selected.actions?.find(action => action.id === 'rebuild_alerts')
    if (rebuildAction) rows.push({ id: 'rebuild_alerts', label: 'Rebuild alerts', detail: 'Rebuild alerts for the selected workspace.', tone: 'ready', action: rebuildAction })
    return rows.slice(0, 8)
}
