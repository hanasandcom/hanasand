'use client'

import { sourceHealthChipClass } from '../pageClientShared'
import { displayRequirementList, displayRequirementText, formatLabel, publicDecisionStatusLabel, readinessOwnerLabel, type SelectedAlertActionPlan } from '../pageModel'
import DecisionStatus from './decision-status'
import CopyPayloadButton from './copy-payload-button'
import SelectedPanelHeader from './selected-panel-header'
import SelectedWatchTerms from './selected-watch-terms'
import RequirementWarning from './requirement-warning'
import TiEvidenceCard from './ti-evidence-card'

export default function SelectedAlertActionPlanPanel({ plan }: { plan: SelectedAlertActionPlan }) {
    const status = plan.ready ? 'ready' : plan.state === 'review' ? 'review' : 'blocked'
    return (
        <div data-ti-selected-alert-action-plan='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <SelectedPanelHeader title={<>Alert actions · {plan.readiness.matchedCandidateCount}/{plan.readiness.candidateCount} matches · {plan.sourceRefs.captureIds.length} captures · {plan.readiness.generationEvidenceWindowReady ? 'evidence current' : 'evidence pending'}</>}>
                <DecisionStatus status={status} />
                <CopyPayloadButton label='Alert action plan' payload={plan} />
            </SelectedPanelHeader>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>
                {plan.handoff.route || plan.route ? 'Console action available.' : 'Console action pending.'}
            </p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.nextAction)}</p>
            <SelectedWatchTerms terms={plan.watchlist.terms} previewCount={4} />
            {plan.evidenceRows.length ? (
                <div data-ti-selected-alert-evidence='true' className='mt-2 grid gap-2'>
                    {plan.evidenceRows.slice(0, 3).map(row => (
                        <TiEvidenceCard key={row.rowId}>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.label}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {formatLabel(row.kind)} · {formatLabel(row.sourceFamily)} · {readinessOwnerLabel(row.ownerLane)}
                                    </p>
                                </div>
                                <span className={sourceHealthChipClass(row.state === 'ready' ? 'ready' : row.state === 'blocked' ? 'blocked' : 'review')}>{publicDecisionStatusLabel(row.state)}</span>
                            </div>
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.evidence.summary)}</p>
                            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                {row.alertId ? <span className={sourceHealthChipClass('ready')}>alert {row.alertId}</span> : null}
                                {row.casePath ? <span className={sourceHealthChipClass('ready')}>{displayRequirementText(row.casePath)}</span> : null}
                                {row.captureIds.length ? <span className={sourceHealthChipClass('ready')}>{row.captureIds.length} source row{row.captureIds.length === 1 ? '' : 's'}</span> : <span className={sourceHealthChipClass('blocked')}>sources syncing</span>}
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {row.route ? 'Source action available.' : 'Source action pending.'}
                            </p>
                            <RequirementWarning items={row.blockers} limit={3} />
                        </TiEvidenceCard>
                    ))}
                </div>
            ) : null}
            {plan.replayRows.length ? (
                <div data-ti-selected-alert-replay='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                    {plan.replayRows.slice(0, 3).map(row => (
                        <span key={row.id} className={sourceHealthChipClass(row.ready ? 'ready' : 'blocked')}>
                            {row.ready ? displayRequirementText(row.exportRoute ?? 'replay ready') : displayRequirementList(row.blockerCodes.slice(0, 2)) || 'case replay syncing'}
                        </span>
                    ))}
                </div>
            ) : null}
            {plan.blockers.length ? (
                <RequirementWarning items={plan.blockers.map(blocker => blocker.detail)} limit={3} spacing='mt-2' />
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Alert rebuild has the required watchlist and sources.</p>
            )}
        </div>
    )
}
