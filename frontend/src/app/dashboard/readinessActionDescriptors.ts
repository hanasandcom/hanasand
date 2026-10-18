import type { WorkbenchAction } from './ti/workbench/workbenchClient'
import type { OperatorScope } from './operatorConsoleTypes'
import { actionScope } from './operatorContextUtils'

const canaryAction: WorkbenchAction = {
    id: 'run_canary_collection', label: 'Run canary', method: 'POST', href: '/api/findings/canary/run',
    body: { operatorApproval: true, approvedBy: 'dashboard', maxSources: 12, maxTasks: 24 },
}

export function canaryCollectionAction(): WorkbenchAction {
    return { ...canaryAction, body: { ...canaryAction.body } }
}

export function rebuildAlertsAction(scope: OperatorScope, disabledReason?: string, includeUndefinedDisabledReason = false): WorkbenchAction {
    return {
        id: 'rebuild_alerts', label: 'Rebuild alerts', method: 'POST', href: '/api/findings/alerts/rebuild',
        body: actionScope(scope),
        ...(disabledReason || includeUndefinedDisabledReason ? { disabledReason } : {}),
    }
}
