import type { WorkbenchDeliveryEvidence, CaseDelivery, WorkbenchCase, WorkbenchOrgContext, CaseTimelineItem, AlertDetailPayload } from '../types'
import { InspectionNotice } from './inspection'
import { deliveryLedgerHref } from './caseRoutes'
import { workflowStatusClass, label, relativeTime } from './presentation'
import Link from 'next/link'
import { safeWorkbenchDetail, sanitizeWorkbenchCopy } from './copy'
import { EvidencePanel } from './EvidencePanel'

export function DeliveryEvidenceRows({ deliveries, selected, orgContext }: { deliveries: Array<WorkbenchDeliveryEvidence | CaseDelivery>, selected: WorkbenchCase, orgContext?: WorkbenchOrgContext }) {
    if (!deliveries.length) {
        return (
            <InspectionNotice
                tone='blocked'
                title='No webhook delivery yet'
                body='Run a webhook test or send this alert to create delivery evidence.'
            />
        )
    }

    return (
        <EvidencePanel>
            <h4 className='text-sm font-semibold text-ui-text'>Webhook delivery evidence</h4>
            <div className='mt-3 grid gap-2'>
                {deliveries.map(delivery => {
                    const ledgerHref = deliveryLedgerHref(orgContext, selected, delivery)
                    return (
                        <div key={delivery.id} className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                            <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                                <div className='flex min-w-0 flex-wrap items-center gap-2'>
                                    <span className='font-mono text-xs font-semibold text-ui-text'>{delivery.id}</span>
                                    <span className={workflowStatusClass(delivery.status === 'delivered' ? 'ready' : delivery.status === 'failed' || delivery.status === 'skipped' ? 'blocked' : 'needs_action')}>{label(delivery.status)}</span>
                                    {delivery.deliveryKind && <span className='rounded-full bg-ui-raised px-2 py-0.5 text-[11px] font-semibold text-ui-primary'>{delivery.deliveryKind}</span>}
                                </div>
                                <Link href={ledgerHref} className='inline-flex min-h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                                    Open ledger
                                </Link>
                            </div>
                            <div className='mt-2 grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>
                                <p><span className='font-semibold text-ui-muted'>Alert:</span> {delivery.alertId}</p>
                                <p><span className='font-semibold text-ui-muted'>Destination:</span> {delivery.webhookDestinationId || 'watchlist url'}</p>
                                <p><span className='font-semibold text-ui-muted'>Attempted:</span> {relativeTime(delivery.attemptedAt)}</p>
                                {'httpStatus' in delivery && delivery.httpStatus !== undefined && <p><span className='font-semibold text-ui-muted'>HTTP:</span> {delivery.httpStatus}</p>}
                            </div>
                            <p className='mt-2 break-all font-mono text-[11px] text-ui-muted'>{delivery.endpointHash} · {delivery.payloadHash}</p>
                            {delivery.error && <p className='mt-2 text-xs font-semibold text-ui-text'>{safeWorkbenchDetail(delivery.error)}</p>}
                        </div>
                    )
                })}
            </div>
        </EvidencePanel>
    )
}

export function TimelineRows({ title, rows }: { title: string, rows: CaseTimelineItem[] }) {
    return (
        <EvidencePanel>
            <h4 className='text-sm font-semibold text-ui-text'>{title}</h4>
            <div className='mt-3 grid gap-3'>
                {rows.map(row => (
                    <div key={row.id} className='grid grid-cols-[auto_1fr] gap-3'>
                        <span className='mt-1 h-2.5 w-2.5 rounded-full bg-ui-primary' />
                        <div>
                            <p className='text-sm font-semibold text-ui-text'>{sanitizeWorkbenchCopy(row.title) || row.title}</p>
                            <p className='mt-1 text-xs leading-5 text-ui-muted'>{sanitizeWorkbenchCopy(row.detail) || row.detail}</p>
                            <p className='mt-1 text-[11px] text-ui-muted'>{relativeTime(row.at)}</p>
                        </div>
                    </div>
                ))}
                {!rows.length && <p className='text-xs text-ui-muted'>Timeline updates with the next case event.</p>}
            </div>
        </EvidencePanel>
    )
}

export function AlertDetailSummary({ alert, fallback }: { alert: NonNullable<AlertDetailPayload['alert']>, fallback: WorkbenchCase }) {
    const workflowContext = alert.workflowContext
    const webhookContext = alert.webhookContext
    const caseId = alert.caseId || alert.caseIdCandidate || workflowContext?.caseIdCandidate
    return (
        <EvidencePanel>
            <div className='flex flex-wrap items-center gap-2'>
                <span className='text-sm font-semibold text-ui-text'>{alert.id || fallback.id}</span>
                <span className={workflowStatusClass(alert.deliveryState === 'delivered' ? 'ready' : alert.deliveryState ? 'needs_action' : 'blocked')}>{label(alert.deliveryState || 'delivery pending')}</span>
                <span className={workflowStatusClass(caseId ? 'ready' : 'needs_action')}>{caseId ? 'case linked' : 'case needed'}</span>
            </div>
            <div className='mt-3 grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>
                <p><span className='font-semibold text-ui-muted'>Review:</span> {label(alert.reviewState || fallback.status)}</p>
                <p><span className='font-semibold text-ui-muted'>Owner:</span> {alert.assignedOwner || fallback.owner || 'unassigned'}</p>
                <p><span className='font-semibold text-ui-muted'>Case state:</span> {label(alert.workflowStatus || alert.reviewState || fallback.status)}</p>
                <p><span className='font-semibold text-ui-muted'>Organization:</span> {alert.organizationId || workflowContext?.organizationId || 'syncing'}</p>
                <p><span className='font-semibold text-ui-muted'>Case:</span> {caseId || 'not linked'}</p>
                <p><span className='font-semibold text-ui-muted'>Sources:</span> {alert.sourceCount ?? fallback.sourceLabel}</p>
                <p><span className='font-semibold text-ui-muted'>Updated:</span> {relativeTime(alert.updatedAt || alert.firstSeenAt || fallback.updatedAt)}</p>
                <p><span className='font-semibold text-ui-muted'>Replays:</span> {alert.replayCount ?? 0}{alert.lastReplayedAt ? ` · ${relativeTime(alert.lastReplayedAt)}` : ''}</p>
                <p className='break-all'><span className='font-semibold text-ui-muted'>Watchlists:</span> {(workflowContext?.watchlistIds || []).join(', ') || 'syncing'}</p>
                <p className='break-all'><span className='font-semibold text-ui-muted'>Destinations:</span> {(webhookContext?.webhookDestinationIds || workflowContext?.webhookDestinationIds || []).join(', ') || (webhookContext?.hasWebhookRoute ? 'delivery available' : 'syncing')}</p>
            </div>
        </EvidencePanel>
    )
}

export function AlertWorkflowReadiness({ detail }: { detail: AlertDetailPayload }) {
    const readiness = detail.workflowExecutionReadiness
    const contract = detail.analystWorkflowContract
    const downstream = detail.downstreamHandoff
    const blockerCodes = [...(readiness?.blockerCodes || []), ...(downstream?.blockerCodes || [])]
        .filter((code, index, source) => source.indexOf(code) === index)
    return (
        <EvidencePanel>
            <div className='flex flex-wrap items-center gap-2'>
                <h4 className='text-sm font-semibold text-ui-text'>Workflow guard</h4>
                <span className={workflowStatusClass(readiness?.ready === false || blockerCodes.length ? 'blocked' : 'ready')}>{readiness?.ready === false || blockerCodes.length ? 'syncing' : 'ready'}</span>
                {readiness?.action && <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{label(readiness.action)}</span>}
            </div>
            <div className='mt-3 grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>
                <p><span className='font-semibold text-ui-muted'>Update:</span> {contract?.mutationRoute || '/v1/dwm/alerts/:id'}</p>
                <p><span className='font-semibold text-ui-muted'>Replay:</span> {contract?.replayRoute || '/v1/dwm/alerts/:id/replay'}</p>
                <p><span className='font-semibold text-ui-muted'>Event count:</span> {readiness?.currentWorkflowEventCount ?? contract?.idempotency?.workflowEventCount ?? 'checking'}</p>
                <p><span className='font-semibold text-ui-muted'>Updated:</span> {relativeTime(readiness?.currentUpdatedAt || contract?.idempotency?.updatedAt || detail.alert?.updatedAt || detail.generatedAt || '')}</p>
                <p><span className='font-semibold text-ui-muted'>Delivery route:</span> {downstream?.deliverySelection?.ready === false ? 'checking' : downstream?.deliverySelection?.selectedWebhookDestinationId || 'checking'}</p>
                <p><span className='font-semibold text-ui-muted'>Customer delivery:</span> {downstream?.customerStatus?.ready === false ? 'checking' : downstream?.customerStatus?.ready === true ? 'ready' : 'checking'}</p>
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
                {blockerCodes.map(code => <span key={code} className={workflowStatusClass('blocked')}>{label(code)}</span>)}
                {!blockerCodes.length && <span className='text-xs text-ui-muted'>Workflow lane is clear.</span>}
            </div>
            {readiness?.blockers?.length ? (
                <div className='mt-3 grid gap-2'>
                    {readiness.blockers.slice(0, 3).map(blocker => (
                        <p key={`${blocker.code}:${blocker.field}`} className='rounded-md border border-ui-danger/35 bg-ui-raised/10 px-2 py-1 text-xs text-ui-text'>
                            {label(blocker.code || 'workflow issue')}{blocker.detail ? `: ${blocker.detail}` : ''}
                        </p>
                    ))}
                </div>
            ) : null}
        </EvidencePanel>
    )
}

export function AlertOperationalReadiness({ detail }: { detail: AlertDetailPayload }) {
    const next = detail.nextBestAction
    const delivery = detail.deliveryReadiness
    const customerStatus = detail.customerStatusHandoff
    const evidence = detail.evidenceFreshness
    const provenance = detail.provenanceFreshness
    const blockerCodes = [...(delivery?.blockerCodes || []), ...(customerStatus?.blockerCodes || [])]
        .filter((code, index, source) => source.indexOf(code) === index)
    return (
        <EvidencePanel>
            <div className='flex flex-wrap items-center gap-2'>
                <h4 className='text-sm font-semibold text-ui-text'>Delivery lane</h4>
                <span className={workflowStatusClass(delivery?.ready || customerStatus?.ready ? 'ready' : blockerCodes.length ? 'blocked' : 'needs_action')}>{delivery?.ready || customerStatus?.ready ? 'ready' : blockerCodes.length ? 'syncing' : 'review'}</span>
            </div>
            <div className='mt-3 grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>
                <p><span className='font-semibold text-ui-muted'>Next:</span> {next?.label || 'Review alert detail.'}</p>
                <p><span className='font-semibold text-ui-muted'>Action:</span> {label(next?.action || 'monitor')}{next?.requiresRationale ? ' · rationale required' : ''}</p>
                <p><span className='font-semibold text-ui-muted'>Delivery:</span> {label(delivery?.state || delivery?.lastDeliveryStatus || customerStatus?.deliveryState || 'checking')}</p>
                <p><span className='font-semibold text-ui-muted'>Customer delivery:</span> {customerStatus?.ready || customerStatus?.deliveryReady ? 'ready' : blockerCodes.length ? 'checking' : 'checking'}</p>
                <p><span className='font-semibold text-ui-muted'>Evidence:</span> {evidence?.evidenceCount ?? customerStatus?.evidenceCount ?? delivery?.evidenceCount ?? 0} item(s){evidence?.newestEvidenceAt ? ` · ${relativeTime(evidence.newestEvidenceAt)}` : ''}</p>
                <p><span className='font-semibold text-ui-muted'>Source details:</span> {(provenance?.sourceIds || []).length} source(s), {(provenance?.captureIds || evidence?.captureIds || delivery?.selectedCaptureIds || customerStatus?.selectedCaptureIds || []).length} capture(s)</p>
            </div>
            {next?.reason ? <p className='mt-3 rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs leading-5 text-ui-muted'>{next.reason}</p> : null}
            <div className='mt-3 flex flex-wrap gap-2'>
                {blockerCodes.map(code => <span key={code} className={workflowStatusClass('blocked')}>{label(code)}</span>)}
                {!blockerCodes.length && <span className='text-xs text-ui-muted'>Delivery and customer lanes are clear.</span>}
            </div>
        </EvidencePanel>
    )
}
