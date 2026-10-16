import type { WorkbenchCase, LocalDecision, CaseDetailState, AlertDetailState, WorkbenchDeliveryEvidence, WorkbenchOrgContext, WorkbenchActionOutcome, CaseMutationInput } from '../types'
import { sendDeliveryDisabledReason } from './actionInputs'
import { severityClass, label, relativeTime } from './presentation'
import { evidenceStrengthLabel } from '@/utils/dwm/display'
import { UserRound, MessageSquareText } from 'lucide-react'
import { CaseActionRail } from './caseActions'
import { BackedInspection } from './inspection'
import { CaseContinuityPanel } from './caseContinuity'

export function CaseDetail({ item, decision, note, ownerDraft, busyAction, compact, caseDetail, alertDetail, actionDeliveries, orgContext, actionMessage, onNoteChange, onOwnerDraftChange, onDecision, onBackedCaseMutation, onCustomerNotification, onReplay, onSend }: {
    item: WorkbenchCase
    decision?: LocalDecision
    note: string
    ownerDraft?: string
    busyAction: string | null
    compact: boolean
    caseDetail?: CaseDetailState
    alertDetail?: AlertDetailState
    actionDeliveries: WorkbenchDeliveryEvidence[]
    orgContext?: WorkbenchOrgContext
    actionMessage: WorkbenchActionOutcome | null
    onNoteChange: (value: string) => void
    onOwnerDraftChange: (value: string) => void
    onDecision: (decision: LocalDecision) => void | Promise<void>
    onBackedCaseMutation: (mutation: CaseMutationInput) => void | Promise<void>
    onCustomerNotification: () => void | Promise<void>
    onReplay: () => void | Promise<void>
    onSend: () => void | Promise<void>
}) {
    const backedCase = caseDetail?.status === 'ready' ? caseDetail.detail.case : undefined
    const backedStatus = backedCase?.status
    const backedOwner = backedCase?.assignedOwner || 'unassigned'
    const effectiveStatus = decision?.status ?? backedStatus ?? item.status
    const effectiveOwner = decision?.owner ?? backedOwner ?? item.owner
    const ownerValue = ownerDraft ?? (effectiveOwner === 'unassigned' ? '' : effectiveOwner)
    const assignableMembers = orgContext?.members.filter(member => member.status === 'active' && ['owner', 'admin', 'editor', 'analyst'].includes(member.role)) || []
    const readOnly = caseDetail?.status === 'ready' && caseDetail.detail.access?.readOnly === true
    const sendDisabledReason = sendDeliveryDisabledReason(item, orgContext)
    return (
        <div className={`${compact ? 'grid gap-4 p-4' : 'grid gap-5 p-5'}`}>
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className={severityClass(item.severity)}>{item.severity}</span>
                        <span className='rounded-full bg-ui-raised px-2 py-0.5 text-xs font-semibold text-ui-primary'>{evidenceStrengthLabel(item.confidence)} evidence</span>
                        <span className='rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-muted'>{label(item.kind)}</span>
                        <span className='rounded-full bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-muted'>{label(effectiveStatus)}</span>
                        {item.persistent && <span className='rounded-full bg-ui-success/10 px-2 py-0.5 text-xs font-semibold text-ui-success'>persistent workflow</span>}
                    </div>
                    <h2 className={`${compact ? 'mt-2 text-xl' : 'mt-3 text-2xl'} font-semibold tracking-normal text-ui-text`}>{item.title}</h2>
                    <p className='mt-1 text-sm text-ui-muted'>Mentioned: {item.company || item.matchedTerm} · Found {relativeTime(item.updatedAt)}</p>
                </div>
                <div className='grid gap-1 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-xs text-ui-muted'>
                    <span className='font-semibold text-ui-text'>{effectiveOwner}</span>
                    <span>{item.company || item.matchedTerm}</span>
                </div>
            </div>

            <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4 lg:grid-cols-[0.48fr_minmax(0,1fr)]'>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                        <UserRound className='h-4 w-4 text-ui-primary' />
                        Owner
                    </span>
                    {assignableMembers.length ? (
                        <select
                            value={ownerValue}
                            onChange={event => onOwnerDraftChange(event.target.value)}
                            disabled={readOnly}
                            className='h-10 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            <option value=''>Unassigned</option>
                            {assignableMembers.map(member => (
                                <option key={member.id} value={member.email}>{member.email} ({member.role})</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            value={ownerValue}
                            onChange={event => onOwnerDraftChange(event.target.value)}
                            placeholder='Assign analyst'
                            className='h-10 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                        />
                    )}
                    <span className='text-[11px] text-ui-muted'>
                        {assignableMembers.length
                            ? readOnly ? 'Member picker is read-only for this case.' : 'Assign owner saves to the active case.'
                            : 'Assignable teammate state is loading; manual owner text stays available.'}
                    </span>
                </label>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                        <MessageSquareText className='h-4 w-4 text-ui-primary' />
                        Decision rationale
                    </span>
                    <textarea
                        value={note}
                        onChange={event => onNoteChange(event.target.value)}
                        placeholder='Record validation, customer route, suppression reason, or follow-up owner'
                        className='min-h-20 resize-y rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                </label>
                <CaseActionRail
                    item={item}
                    note={note}
                    owner={ownerValue.trim() || effectiveOwner}
                    effectiveStatus={effectiveStatus}
                    busyAction={busyAction}
                    caseDetail={caseDetail}
                    sendDisabledReason={sendDisabledReason}
                    onDecision={onDecision}
                    onBackedCaseMutation={onBackedCaseMutation}
                    onCustomerNotification={onCustomerNotification}
                    onReplay={onReplay}
                    onSend={onSend}
                />
            </section>

            <section className='grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]'>
                <BackedInspection item={item} caseDetail={caseDetail} alertDetail={alertDetail} actionDeliveries={actionDeliveries} orgContext={orgContext} compact={compact} />
                <CaseContinuityPanel
                    item={item}
                    decision={decision}
                    caseDetail={caseDetail}
                    actionMessage={actionMessage}
                    orgContext={orgContext}
                />
            </section>

        </div>
    )
}
