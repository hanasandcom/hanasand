import type { WorkbenchCase, CaseDetailState, LocalDecision, CaseMutationInput, WorkbenchCaseMutationAction, CaseAllowedAction } from '../types'
import { customerNotificationActionState } from './caseRoutes'

function DecisionButton({ busy = false, disabledReason, onClick, children }: { busy?: boolean, disabledReason?: string, onClick: () => void | Promise<void>, children: string }) {
    const disabled = busy || Boolean(disabledReason)
    return (
        <button type='button' onClick={onClick} disabled={disabled} title={disabledReason} className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'>
            {children}
        </button>
    )
}

export function CaseActionRail({ item, note, owner, effectiveStatus, busyAction, caseDetail, sendDisabledReason, onDecision, onBackedCaseMutation, onCustomerNotification, onReplay, onSend }: {
    item: WorkbenchCase
    note: string
    owner: string
    effectiveStatus: string
    busyAction: string | null
    caseDetail?: CaseDetailState
    sendDisabledReason?: string
    onDecision: (decision: LocalDecision) => void | Promise<void>
    onBackedCaseMutation: (mutation: CaseMutationInput) => void | Promise<void>
    onCustomerNotification: () => void | Promise<void>
    onReplay: () => void | Promise<void>
    onSend: () => void | Promise<void>
}) {
    const readyCase = caseDetail?.status === 'ready' ? caseDetail.detail.case : undefined
    const hasBackedCase = Boolean(readyCase)
    const hasBackedAlertWorkflow = item.kind === 'dwm_alert' && item.persistent
    const busy = Boolean(busyAction)
    const closeAction = effectiveStatus === 'closed' ? 'reopen' : 'close'

    if (!hasBackedCase) {
        return (
            <div className='grid gap-2 rounded-lg border border-ui-danger/35 bg-ui-raised/10 p-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-text'>{hasBackedAlertWorkflow ? 'Backed alert workflow' : 'Session-local triage'}</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>
                        {hasBackedAlertWorkflow
                            ? 'Updates the persisted alert and refreshes detail. Case actions unlock when a case is linked.'
                            : item.missingDependency || 'Live case detail or persisted DWM alert is syncing. These controls only update this browser session until then.'}
                    </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'reviewing', owner, reason: note || 'Review started.' })}>Review</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'escalated', owner, reason: note || 'Escalated for customer or incident response.' })}>Escalate</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'suppressed', owner, reason: note || 'Suppressed as low-value or false positive.' })}>Suppress</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: effectiveStatus === 'closed' ? 'needs_review' : 'closed', owner, reason: note || (effectiveStatus === 'closed' ? 'Reopened for review.' : 'Closed in recent attacks.') })}>
                        {effectiveStatus === 'closed' ? 'Reopen' : 'Close'}
                    </DecisionButton>
                    {item.kind === 'dwm_alert' && (
                        <>
                            <DecisionButton busy={busy || busyAction === `replay:${item.id}`} disabledReason={hasBackedAlertWorkflow ? undefined : 'Replay requires a persistent /api/findings/alerts/:id alert.'} onClick={onReplay}>Replay</DecisionButton>
                            <DecisionButton busy={busy || busyAction === `send:${item.id}`} disabledReason={sendDisabledReason || (hasBackedAlertWorkflow ? undefined : 'Send requires a persistent alert and webhook delivery route.')} onClick={onSend}>Send</DecisionButton>
                        </>
                    )}
                </div>
            </div>
        )
    }

    const hasOwner = owner.trim() && owner.trim() !== 'unassigned'
    const noteText = note.trim()
    const notificationState = customerNotificationActionState(caseDetail)
    return (
        <div className='grid gap-2 rounded-lg border border-ui-success/35 bg-ui-success/10 p-3'>
            <div>
                <p className='text-xs font-semibold uppercase text-ui-success'>Live case actions</p>
                <p className='mt-1 text-xs leading-5 text-ui-muted'>Updates the selected case and refreshes the detail pane.</p>
                {item.caseDetailHref && <p className='mt-1 text-xs leading-5 text-ui-muted'>Case package includes evidence, timeline, delivery, and next actions.</p>}
            </div>
            <div className='flex flex-wrap gap-2'>
                <CaseMutationButton
                    item={item}
                    action='assign'
                    label='Assign owner'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!hasOwner ? 'Owner is required.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'assign', assignedOwner: owner.trim(), note: noteText || `Assigned to ${owner.trim()}.` })}
                />
                <CaseMutationButton
                    item={item}
                    action='note'
                    label='Add note'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Decision rationale is required.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'note', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText })}
                />
                <CaseMutationButton
                    item={item}
                    action='review'
                    label='Start review'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Review requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'review', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText })}
                />
                <CaseMutationButton
                    item={item}
                    action='escalate'
                    label='Escalate'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Escalation requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'escalate', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || 'Escalated for customer or incident response.' })}
                />
                <CaseMutationButton
                    item={item}
                    action='suppress'
                    label='Suppress'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Suppression requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'suppress', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || 'Suppressed as low-value or false positive.' })}
                />
                <CaseMutationButton
                    item={item}
                    action='false_positive'
                    label='False positive'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'False-positive decision requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'false_positive', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText })}
                />
                <CaseMutationButton
                    item={item}
                    action={closeAction}
                    label={effectiveStatus === 'closed' ? 'Reopen' : 'Close'}
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={closeAction === 'close' && !noteText ? 'Closing requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: closeAction, assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || (closeAction === 'reopen' ? 'Reopened for review.' : 'Closed from recent attacks.') })}
                />
                <DecisionButton
                    busy={busy || busyAction === `case:${item.id}:customer_notification`}
                    onClick={onCustomerNotification}
                    disabledReason={notificationState.disabledReason || (!noteText ? 'Customer notification needs decision rationale.' : undefined)}
                >
                    Record notification
                </DecisionButton>
                {item.kind === 'dwm_alert' && (
                    <>
                        <DecisionButton busy={busy || busyAction === `replay:${item.id}`} onClick={onReplay}>Replay</DecisionButton>
                        <DecisionButton busy={busy || busyAction === `send:${item.id}`} disabledReason={sendDisabledReason} onClick={onSend}>Send</DecisionButton>
                    </>
                )}
            </div>
        </div>
    )
}

export function CaseMutationButton({ item, action, label: actionLabel, busy, busyAction, allowedActions, disabledReason, onClick }: {
    item: WorkbenchCase
    action: WorkbenchCaseMutationAction
    label: string
    busy: boolean
    busyAction: string | null
    allowedActions: CaseAllowedAction[]
    disabledReason?: string
    onClick: () => void | Promise<void>
}) {
    const allowed = allowedActions.find(candidate => candidate.id === action)
    const blockedReason = disabledReason || allowed?.disabledReason || (allowed && !allowed.enabled ? 'Not applicable for current case status.' : undefined)
    const disabled = busy || Boolean(blockedReason)
    return (
        <button
            type='button'
            data-detail-action={action}
            onClick={onClick}
            disabled={disabled}
            title={blockedReason}
            className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
        >
            {busyAction === `case:${item.id}:${action}` ? 'Saving...' : actionLabel}
        </button>
    )
}
