import type { WorkbenchCase, LocalDecision, CaseDetailState, WorkbenchActionOutcome, WorkbenchOrgContext } from '../types'
import { caseReplayExportState, deliveryLedgerHref } from './caseRoutes'
import { relativeTime, workflowStatusClass, label } from './presentation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

export function CaseContinuityPanel({ item, decision, caseDetail, actionMessage, orgContext }: { item: WorkbenchCase, decision?: LocalDecision, caseDetail?: CaseDetailState, actionMessage: WorkbenchActionOutcome | null, orgContext?: WorkbenchOrgContext }) {
    const detail = caseDetail?.status === 'ready' ? caseDetail.detail : undefined
    const caseRecord = detail?.case
    const workflowEvents = [...(caseRecord?.workflowEvents || []), ...(detail?.alertContext?.workflowEvents || [])]
    const replayExport = caseReplayExportState(item, caseDetail)
    const ownerEvents = workflowEvents
        .filter(event => event.toOwner || event.fromOwner || event.action === 'assign')
        .slice(-4)
        .reverse()
    const noteEvents = workflowEvents
        .filter(event => event.note)
        .slice(-4)
        .reverse()
    const visibility = detail?.access?.visibilityDecision
    const allowedActions = detail?.nextAllowedActions || []
    const notificationContext = detail?.customerNotificationContext
    const notificationDelivery = notificationContext?.latest?.webhookDeliveryId ? {
        id: notificationContext.latest.webhookDeliveryId,
        alertId: item.id,
        status: notificationContext.latest.webhookStatus || 'recorded',
        deliveryKind: notificationContext.latest.deliveryMode,
        attemptedAt: notificationContext.latest.at,
        webhookDestinationId: notificationContext.latest.webhookDestinationId,
        endpointHash: 'notification_endpoint_hash_not_returned',
        payloadHash: 'notification_payload_hash_not_returned',
    } : undefined
    const notificationLedgerHref = notificationDelivery ? deliveryLedgerHref(orgContext, item, notificationDelivery) : undefined
    const latestTimeline = (detail?.timeline || [])
        .filter(row => row.rationale || row.toOwner || row.toStatus || row.eventType)
        .slice(-5)
        .reverse()
    const refreshText = caseDetail?.status === 'loading'
        ? 'refreshing /api/cases/:id'
        : caseDetail?.status === 'error'
            ? caseDetail.error
            : detail
                ? `refreshed ${relativeTime(detail.generatedAt)}`
                : item.caseDetailHref ? 'case detail loading' : item.missingDependency || 'case link pending'

    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-ui-border px-4 py-3 sm:items-center'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Continuity</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>Assignee changes, rationale, action outcome, allowed moves, visibility, and refresh state.</p>
                </div>
                <span className={workflowStatusClass(caseDetail?.status === 'error' || (!detail && !item.caseDetailHref) ? 'blocked' : caseDetail?.status === 'loading' ? 'needs_action' : 'ready')}>{caseDetail?.status || (item.caseDetailHref ? 'pending' : 'syncing')}</span>
            </div>
            <div className='grid gap-3 p-4 xl:grid-cols-[0.85fr_1fr_0.85fr]'>
                <div className='grid gap-3'>
                    <ContinuityBlock title='Assignee history'>
                        <p className='text-xs text-ui-muted'>Latest owner: <span className='font-semibold text-ui-text'>{caseRecord?.assignedOwner || item.owner || 'unassigned'}</span></p>
                        <div className='mt-2 grid gap-2'>
                            {ownerEvents.map(event => (
                                <ContinuityEvent key={event.id} title={event.toOwner || event.fromOwner || event.action} detail={`${event.fromOwner || 'unassigned'} -> ${event.toOwner || caseRecord?.assignedOwner || 'unassigned'} · ${event.actor || 'actor syncing'}`} at={event.at} />
                            ))}
                            {!ownerEvents.length && <p className='text-xs leading-5 text-ui-muted'>Assignment history is live; latest owner is shown above.</p>}
                        </div>
                    </ContinuityBlock>
                    <ContinuityBlock title='Visibility decision'>
                        <p className='text-xs leading-5 text-ui-muted'>
                            {visibility ? `${visibility.allowed ? 'Visible' : 'Needs access'} under ${visibility.alertVisibilityPolicy}; roles ${visibility.allowedRoles.join(', ')}${visibility.reason ? `; reason ${visibility.reason}` : ''}.` : 'Visibility check is loading the case access decision.'}
                        </p>
                        <p className='mt-2 text-xs text-ui-muted'>Mutations: <span className='font-semibold text-ui-text'>{detail?.access?.readOnly ? 'read-only' : detail ? 'allowed' : 'requires case detail'}</span></p>
                    </ContinuityBlock>
                </div>
                <ContinuityBlock title='Rationale timeline'>
                    <div className='grid gap-2'>
                        {noteEvents.map(event => (
                            <ContinuityEvent key={event.id} title={label(event.action)} detail={event.note || 'No rationale'} at={event.at} />
                        ))}
                        {caseRecord?.lastDecision && <p className='rounded-lg border border-ui-border bg-ui-panel p-2 text-xs leading-5 text-ui-muted'>Last decision: {caseRecord.lastDecision}</p>}
                        {decision?.status && <p className='rounded-lg border border-ui-danger/35 bg-ui-raised/10 p-2 text-xs leading-5 text-ui-muted'>Session-local: {label(decision.status)}{decision.reason ? ` · ${decision.reason}` : ''}</p>}
                        {!noteEvents.length && !caseRecord?.lastDecision && !decision?.status && <p className='text-xs leading-5 text-ui-muted'>Rationale timeline is watching for the first analyst note or decision.</p>}
                    </div>
                </ContinuityBlock>
                <div className='grid gap-3'>
                    <ContinuityBlock title='Action outcome'>
                        <p className={`text-xs leading-5 ${actionMessage ? actionMessage.ok ? 'text-ui-success' : 'text-ui-text' : 'text-ui-muted'}`}>
                            {actionMessage?.text || 'Console actions stream here.'}
                        </p>
                        <p className='mt-2 text-xs text-ui-muted'>Refresh: {refreshText}</p>
                    </ContinuityBlock>
                    <ContinuityBlock title='Case package'>
                        <div data-case-replay-export-state={replayExport.status} className='grid gap-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className={workflowStatusClass(replayExport.status)}>{label(replayExport.status)}</span>
                                <span className='text-xs text-ui-muted'>{replayExport.detail}</span>
                            </div>
                            <div className='grid gap-1 text-xs text-ui-muted sm:grid-cols-2 xl:grid-cols-1'>
                                <p><span className='font-semibold text-ui-muted'>Events:</span> {replayExport.workflowEventCount}</p>
                                <p><span className='font-semibold text-ui-muted'>Timeline:</span> {replayExport.timelineCount}</p>
                                <p><span className='font-semibold text-ui-muted'>Delivery rows:</span> {replayExport.deliveryCount}</p>
                                <p><span className='font-semibold text-ui-muted'>Action payloads:</span> {replayExport.nextActionCount}</p>
                            </div>
                            {replayExport.href ? (
                                <Link href={replayExport.href} className='inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                    <span className='truncate'>Open case package</span>
                                    <ExternalLink className='h-3.5 w-3.5 shrink-0' />
                                </Link>
                            ) : null}
                            {replayExport.blockers.length ? (
                                <div className='flex flex-wrap gap-2'>
                                    {replayExport.blockers.map(blocker => <span key={blocker} className={workflowStatusClass('blocked')}>{label(blocker)}</span>)}
                                </div>
                            ) : null}
                        </div>
                    </ContinuityBlock>
                    <ContinuityBlock title='Next allowed actions'>
                        <div className='flex flex-wrap gap-2'>
                            {allowedActions.map(action => (
                                <span key={action.id} title={action.disabledReason} className={workflowStatusClass(action.enabled ? 'ready' : 'blocked')}>{action.label}</span>
                            ))}
                            {!allowedActions.length && <span className='text-xs text-ui-muted'>Action matrix is clear for this case state.</span>}
                        </div>
                    </ContinuityBlock>
                    <ContinuityBlock title='Customer notification'>
                        <p className='text-xs leading-5 text-ui-muted'>
                            {notificationContext?.notified
                                ? `Recorded ${notificationContext.notificationCount} notification${notificationContext.notificationCount === 1 ? '' : 's'}; latest ${notificationContext.latest?.id || 'delivery'} via ${label(notificationContext.latest?.deliveryMode || notificationContext.modes?.[0] || 'webhook_delivery')}.`
                                : detail ? 'Customer notification has not been recorded for this case yet.' : 'Delivery state streams after case detail loads.'}
                        </p>
                        {notificationLedgerHref ? (
                            <Link href={notificationLedgerHref} className='mt-2 inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                <span className='truncate'>Open delivery history</span>
                                <ExternalLink className='h-3.5 w-3.5 shrink-0' />
                            </Link>
                        ) : null}
                    </ContinuityBlock>
                    <ContinuityBlock title='Recent audit'>
                        <div className='grid gap-2'>
                            {latestTimeline.slice(0, 3).map(row => (
                                <ContinuityEvent key={row.id} title={row.title} detail={row.detail || row.rationale || row.eventType || 'case event'} at={row.at} />
                            ))}
                            {!latestTimeline.length && <p className='text-xs leading-5 text-ui-muted'>Timeline stream updates with case events.</p>}
                        </div>
                    </ContinuityBlock>
                </div>
            </div>
        </section>
    )
}

export function ContinuityBlock({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <h4 className='text-xs font-semibold uppercase text-ui-muted'>{title}</h4>
            <div className='mt-2'>{children}</div>
        </div>
    )
}

export function ContinuityEvent({ title, detail, at }: { title: string, detail: string, at?: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-2'>
            <p className='text-xs font-semibold text-ui-text'>{title}</p>
            <p className='mt-1 text-xs leading-5 text-ui-muted'>{detail}</p>
            {at && <p className='mt-1 text-[11px] text-ui-muted'>{relativeTime(at)}</p>}
        </div>
    )
}
