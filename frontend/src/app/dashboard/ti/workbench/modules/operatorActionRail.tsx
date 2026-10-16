import type { WorkbenchCase, WorkbenchOrgContext, CaseDetailState, AlertDetailState, WorkbenchDeliveryEvidence, WorkbenchAction } from '../types'
import { sanitizeWorkbenchCopy } from './copy'
import { workflowStatusClass, label } from './presentation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { actionRailRows } from './rail/actionRailRows'

export function OperatorActionRail({ selected, orgContext, caseDetail, alertDetail, actionDeliveries = [], note, busyAction, onRunAction, onCustomerNotification, onCopyPayload }: {
    selected?: WorkbenchCase
    orgContext?: WorkbenchOrgContext
    caseDetail?: CaseDetailState
    alertDetail?: AlertDetailState
    actionDeliveries?: WorkbenchDeliveryEvidence[]
    note: string
    busyAction: string | null
    onRunAction: (action: WorkbenchAction) => void | Promise<void>
    onCustomerNotification: () => void | Promise<void>
    onCopyPayload: (payload?: unknown) => void | Promise<void>
}) {
    const rows = actionRailRows(selected, orgContext, caseDetail, alertDetail, actionDeliveries, note)
        .filter(row => !row.disabledReason && row.tone === 'ready')

    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='border-b border-ui-border px-4 py-3'>
                <h3 className='text-sm font-semibold text-ui-text'>Operator actions</h3>
                <p className='mt-0.5 text-xs text-ui-muted'>Run the backed action, open the record, or copy the selected review package.</p>
            </div>
            <div className='grid gap-2 p-3'>
                {rows.map(row => (
                    <div key={row.id} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='text-xs font-semibold uppercase text-ui-muted'>{sanitizeWorkbenchCopy(row.label) || row.label}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted'>{sanitizeWorkbenchCopy(row.detail) || row.detail}</p>
                            </div>
                            <span className={workflowStatusClass(row.tone)}>{label(row.tone)}</span>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                            {row.href ? (
                                <Link href={row.href} className='inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:border-ui-border hover:bg-ui-raised'>
                                    Open
                                    <ExternalLink className='h-3.5 w-3.5' />
                                </Link>
                            ) : null}
                            {row.action ? (
                                <button
                                    type='button'
                                    disabled={Boolean(busyAction) || Boolean(row.disabledReason || row.action.disabledReason)}
                                    title={row.disabledReason || row.action.disabledReason}
                                    onClick={() => onRunAction(row.action as WorkbenchAction)}
                                    className='inline-flex min-h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:border-ui-border hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {busyAction === `action:${selected?.id}:${row.action.id}` ? 'Running...' : row.action.label}
                                </button>
                            ) : null}
                            {row.copyPayload !== undefined ? (
                                <button
                                    type='button'
                                    disabled={Boolean(busyAction)}
                                    onClick={() => onCopyPayload(row.copyPayload)}
                                    className='inline-flex min-h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:border-ui-border hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    Copy handoff
                                </button>
                            ) : null}
                            {row.customerNotification ? (
                                <button
                                    type='button'
                                    disabled={Boolean(busyAction) || Boolean(row.disabledReason)}
                                    title={row.disabledReason}
                                    onClick={onCustomerNotification}
                                    className='inline-flex min-h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:border-ui-border hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {busyAction === `case:${selected?.id}:customer_notification` ? 'Recording...' : 'Record notification'}
                                </button>
                            ) : null}
                            {!row.href && !row.action && row.copyPayload === undefined && !row.customerNotification && (
                                <button type='button' disabled title={row.disabledReason} className='inline-flex min-h-8 cursor-not-allowed items-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-muted'>
                                    Needs setup
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {!rows.length && (
                    <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>Select an attack to see ready actions.</p>
                )}
            </div>
        </section>
    )
}
