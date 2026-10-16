import type { WorkbenchAction, WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'

export function caseReadinessMutationActions(item: WorkbenchProductReadinessItem): WorkbenchAction[] {
    const caseHref = item.caseDetailHref
    const mutationBlockedReason = !caseHref
        ? 'Case mutation requires a backed /api/cases/:id route.'
        : item.caseDetailReady
            ? item.caseDetailReadOnly ? 'Case detail is read-only for the current member.' : undefined
            : 'Case mutation requires readable case detail from /api/cases/:id.'
    const ownerBlockedReason = mutationBlockedReason || (item.assignedOwner ? undefined : 'Assignment requires an owner returned by analyst process status.')
    return [
        {
            id: 'assign_case_owner',
            label: 'Assign owner',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: { action: 'assign', actor: 'dashboard', assignedOwner: item.assignedOwner, note: 'Assigned from case list.' },
            disabledReason: ownerBlockedReason,
        },
        {
            id: 'escalate_case',
            label: 'Escalate case',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: { action: 'escalate', actor: 'dashboard', assignedOwner: item.assignedOwner, note: 'Escalated from case list after evidence review.' },
            disabledReason: mutationBlockedReason,
        },
        {
            id: 'record_case_note',
            label: 'Record note',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: { action: 'note', actor: 'dashboard', assignedOwner: item.assignedOwner, note: 'Case list review recorded.' },
            disabledReason: mutationBlockedReason,
        },
        {
            id: 'suppress_case',
            label: 'Suppress case',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: { action: 'suppress', actor: 'dashboard', assignedOwner: item.assignedOwner, note: 'Suppressed from case list after evidence review.' },
            disabledReason: mutationBlockedReason,
        },
        {
            id: item.caseStatus === 'closed' ? 'reopen_case' : 'close_case',
            label: item.caseStatus === 'closed' ? 'Reopen case' : 'Close case',
            method: 'PATCH',
            href: caseHref || '/api/cases/:id',
            body: {
                action: item.caseStatus === 'closed' ? 'reopen' : 'close',
                actor: 'dashboard',
                assignedOwner: item.assignedOwner,
                note: item.caseStatus === 'closed' ? 'Reopened from case list for review.' : 'Closed from case list after evidence review.',
            },
            disabledReason: mutationBlockedReason,
        },
    ]
}

