import type { WorkbenchCase, CaseDetailState, AlertDetailState, WorkbenchDeliveryEvidence, WorkbenchOrgContext } from '../types'
import { mergeDeliveryEvidence } from './payloadParsing'
import { relatedLinkHref } from './handoffRows'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { caseExportHref } from './caseRoutes'
import { AlertDetailSummary, AlertWorkflowReadiness, AlertOperationalReadiness, DeliveryEvidenceRows, TimelineRows } from './alertEvidence'
import { workflowStatusClass, label, relativeTime } from './presentation'
import { CaseEvidenceRows, CaseWatchlistRows, AlertEvidenceRows } from './caseEvidence'

export function BackedInspection({ item, caseDetail, alertDetail, actionDeliveries, orgContext, compact }: { item: WorkbenchCase, caseDetail?: CaseDetailState, alertDetail?: AlertDetailState, actionDeliveries: WorkbenchDeliveryEvidence[], orgContext?: WorkbenchOrgContext, compact: boolean }) {
    const localDeliveries = item.deliveryEvidence || []
    const detailDeliveries = caseDetail?.status === 'ready' ? caseDetail.detail.deliveries || [] : []
    const deliveries = detailDeliveries.length ? detailDeliveries : mergeDeliveryEvidence(actionDeliveries, localDeliveries)
    const blockedDependency = item.missingDependency || (!item.caseDetailHref && item.kind === 'dwm_alert' ? 'Case link is syncing to this alert. Open the dark web case while the live alert record finishes loading.' : '')
    const alertRecord = alertDetail?.status === 'ready' ? alertDetail.detail.alert : undefined
    const alertEvidence = alertRecord?.evidence || []
    const dwmWorkspaceHref = item.kind === 'dwm_alert' ? relatedLinkHref(item, 'Open dark web case') || `/findings?alert=${encodeURIComponent(item.id)}` : ''

    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-ui-border px-4 py-3 sm:items-center'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Backed inspection</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>Alert detail, case timeline, evidence, delivery attempts, and missing dependencies.</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    {dwmWorkspaceHref && (
                        <Link href={dwmWorkspaceHref} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:bg-ui-raised'>
                            Dark web case
                            <ExternalLink className='h-3.5 w-3.5' />
                        </Link>
                    )}
                    {item.persistent && item.kind === 'dwm_alert' && (
                        <Link href={`/api/findings/alerts/${encodeURIComponent(item.id)}`} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:bg-ui-raised'>
                            Alert API
                            <ExternalLink className='h-3.5 w-3.5' />
                        </Link>
                    )}
                    {item.caseDetailHref && (
                        <>
                            <Link href={item.caseDetailHref} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:bg-ui-raised'>
                                Case API
                                <ExternalLink className='h-3.5 w-3.5' />
                            </Link>
                            <Link href={caseExportHref(item.caseDetailHref)} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:bg-ui-raised'>
                                Case package
                                <ExternalLink className='h-3.5 w-3.5' />
                            </Link>
                        </>
                    )}
                </div>
            </div>
            <div className={`grid gap-3 p-4 ${compact ? 'xl:grid-cols-[0.85fr_1fr]' : 'xl:grid-cols-[0.8fr_1fr]'}`}>
                <div className='grid gap-3'>
                    {alertDetail?.status === 'loading' && <InspectionNotice tone='neutral' title='Loading alert detail' body='Alert detail is updating through the dashboard proxy.' />}
                    {alertDetail?.status === 'error' && <InspectionNotice tone='blocked' title='Alert detail needs attention' body={alertDetail.error} />}
                    {alertRecord ? <AlertDetailSummary alert={alertRecord} fallback={item} /> : null}
                    {alertDetail?.status === 'ready' ? <AlertWorkflowReadiness detail={alertDetail.detail} /> : null}
                    {alertDetail?.status === 'ready' ? <AlertOperationalReadiness detail={alertDetail.detail} /> : null}
                    {caseDetail?.status === 'loading' && <InspectionNotice tone='neutral' title='Loading case detail' body='Case detail is updating through the dashboard proxy.' />}
                    {caseDetail?.status === 'error' && <InspectionNotice tone='blocked' title='Case detail needs attention' body={caseDetail.error} />}
                    {blockedDependency && !caseDetail && <InspectionNotice tone='blocked' title='Case link pending' body={blockedDependency} />}
                    {caseDetail?.status === 'ready' ? (
                        <>
                            <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-sm font-semibold text-ui-text'>{caseDetail.detail.case?.id || 'case'}</span>
                                    <span className={workflowStatusClass(caseDetail.detail.case?.status === 'closed' ? 'blocked' : 'ready')}>{label(caseDetail.detail.case?.status || 'syncing')}</span>
                                    {caseDetail.detail.access?.role && <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{caseDetail.detail.access.role}</span>}
                                    {caseDetail.detail.access?.visibilityDecision && <span className={workflowStatusClass(caseDetail.detail.access.visibilityDecision.allowed ? 'ready' : 'blocked')}>{caseDetail.detail.access.visibilityDecision.alertVisibilityPolicy}</span>}
                                </div>
                                <p className='mt-2 text-sm leading-6 text-ui-muted'>{caseDetail.detail.case?.summary || 'Case summary is being prepared from the latest evidence.'}</p>
                                <div className='mt-3 grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>
                                    <p><span className='font-semibold text-ui-muted'>Owner:</span> {caseDetail.detail.case?.assignedOwner || 'unassigned'}</p>
                                    <p><span className='font-semibold text-ui-muted'>Alert:</span> {caseDetail.detail.case?.alertId || caseDetail.detail.alert?.id || 'none'}</p>
                                    <p><span className='font-semibold text-ui-muted'>Delivery:</span> {caseDetail.detail.deliveryContext?.deliveryCount ?? 0} attempt(s)</p>
                                    <p><span className='font-semibold text-ui-muted'>Updated:</span> {relativeTime(caseDetail.detail.case?.updatedAt || caseDetail.detail.generatedAt)}</p>
                                    <p><span className='font-semibold text-ui-muted'>Mutate:</span> {caseDetail.detail.access?.readOnly ? 'read-only role' : 'allowed'}</p>
                                </div>
                            </div>
                            <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                <h4 className='text-sm font-semibold text-ui-text'>Allowed next actions</h4>
                                <div className='mt-2 flex flex-wrap gap-2'>
                                    {(caseDetail.detail.nextAllowedActions || []).map(action => (
                                        <span key={action.id} title={action.disabledReason} className={workflowStatusClass(action.enabled ? 'ready' : 'blocked')}>{action.label}</span>
                                    ))}
                                    {!(caseDetail.detail.nextAllowedActions || []).length && (caseDetail.detail.nextActions || []).map(action => (
                                        <span key={String(action)} className='rounded-full bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted'>{String(action)}</span>
                                    ))}
                                    {!(caseDetail.detail.nextAllowedActions || caseDetail.detail.nextActions || []).length && <span className='text-xs text-ui-muted'>No more actions for this case state.</span>}
                                </div>
                            </div>
                        </>
                    ) : null}
                    <DeliveryEvidenceRows deliveries={deliveries} selected={item} orgContext={orgContext} />
                </div>
                <div className='grid gap-3'>
                    {caseDetail?.status === 'ready' && (
                        <>
                            <TimelineRows title='Case timeline' rows={caseDetail.detail.timeline || []} />
                            <CaseEvidenceRows evidence={caseDetail.detail.evidence || []} />
                            <CaseWatchlistRows watchlists={caseDetail.detail.watchlists || []} orgContext={orgContext} />
                        </>
                    )}
                    {caseDetail?.status !== 'ready' && alertEvidence.length ? <AlertEvidenceRows evidence={alertEvidence} /> : null}
                    {caseDetail?.status !== 'ready' && alertDetail?.status === 'ready' && alertDetail.detail.timeline?.length ? <TimelineRows title='Alert timeline' rows={alertDetail.detail.timeline} /> : null}
                    {caseDetail?.status !== 'ready' && !deliveries.length && (
                        <InspectionNotice
                            tone='neutral'
                            title='No delivery sent'
                            body='Delivery evidence streams here from webhook tests and alert sends.'
                        />
                    )}
                </div>
            </div>
        </section>
    )
}

export function InspectionNotice({ tone, title, body }: { tone: 'neutral' | 'blocked', title: string, body: string }) {
    return (
        <div className={`rounded-lg border p-3 ${tone === 'blocked' ? 'border-ui-danger/35 bg-ui-raised/10' : 'border-ui-border bg-ui-raised'}`}>
            <h4 className={`text-sm font-semibold ${tone === 'blocked' ? 'text-ui-text' : 'text-ui-text'}`}>{title}</h4>
            <p className='mt-1 text-xs leading-5 text-ui-muted'>{body}</p>
        </div>
    )
}
