'use client'

import { actorEnrichmentConsumerLabel, actorEnrichmentConsumerState, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { displayRequirementText, formatLabel, publicStateLabel, readinessOwnerLabel, sourceHealthFieldLabel, sourceRequestRouteLabel, type SelectedEnrichmentTriage } from '../pageModel'
import DecisionStatus from './decision-status'
import CopyPayloadButton from './copy-payload-button'
import SelectedPanelHeader from './selected-panel-header'
import TiEvidenceCard from './ti-evidence-card'

export default function SelectedEnrichmentTriagePanel({ triage }: { triage: SelectedEnrichmentTriage }) {
    return (
        <div data-ti-selected-enrichment-triage='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <SelectedPanelHeader title={<>Source actions · {triage.summary.sourceRows} sources · {triage.summary.intakeItems} work items · {triage.summary.sourceRequests} requests · {triage.summary.captures} captures</>}>
                <DecisionStatus status={triage.state} />
                <CopyPayloadButton label='Review alert' payload={triage} />
            </SelectedPanelHeader>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(triage.route)}</p>
            <div className='mt-2 grid gap-2'>
                {triage.rows.slice(0, 3).map(row => (
                    <TiEvidenceCard key={row.id}>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {formatLabel(row.sourceFamily)} · {formatDate(row.lastChecked)} · {row.evidence.parserStatus ?? 'processing status pending'}
                                </p>
                            </div>
                            <span className={sourceHealthChipClass(row.state)}>{publicStateLabel(row.state)}</span>
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5' data-ti-selected-enrichment-readiness='true'>
                            <span className={sourceHealthChipClass(row.ownerLane === 'source' ? 'blocked' : row.state)}>{readinessOwnerLabel(row.ownerLane)}</span>
                            <span className={sourceHealthChipClass(row.matchingIntakeItemIds.length ? 'review' : 'blocked')}>{row.matchingIntakeItemIds.length} source item{row.matchingIntakeItemIds.length === 1 ? '' : 's'}</span>
                            {row.captureId ? <span className={sourceHealthChipClass('ready')}>source linked</span> : <span className={sourceHealthChipClass('blocked')}>sources syncing</span>}
                            {row.sourceRequestId ? <span className={sourceHealthChipClass('review')}>request {row.sourceRequestId}</span> : null}
                        </div>
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.recommendedAction)}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{sourceRequestRouteLabel(row.remediationPath)} in the analyst console.</p>
                        {row.consumerReadiness.length ? (
                            <div className='mt-2 grid gap-1.5'>
                                {row.consumerReadiness.slice(0, 3).map(readiness => (
                                    <div key={`${row.id}-${readiness.consumer}`} className='flex min-w-0 flex-wrap items-center justify-between gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2 py-1.5 dark:border-ui-border dark:bg-ui-raised'>
                                        <span className='min-w-0 wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{actorEnrichmentConsumerLabel(readiness.consumer)}</span>
                                        <span className={sourceHealthChipClass(actorEnrichmentConsumerState(readiness.state))}>{readiness.ready ? 'ready' : readiness.retryable ? 'retry scheduled' : readiness.blockerCodes.length ? `${readiness.blockerCodes.length} follow-up${readiness.blockerCodes.length === 1 ? '' : 's'}` : publicStateLabel(readiness.state)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>Map this source to a customer action.</p>
                        )}
                        {row.requestedFields.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>Needs {row.requestedFields.map(sourceHealthFieldLabel).slice(0, 3).join(', ')}.</p>
                        ) : null}
                    </TiEvidenceCard>
                ))}
            </div>
        </div>
    )
}
