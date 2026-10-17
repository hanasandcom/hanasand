'use client'

import { sourceHealthChipClass } from '../pageClientShared'
import { displayRequirementText, formatLabel, type SelectedDeliveryReadinessPlan } from '../pageModel'
import DecisionStatus from './decision-status'
import CopyPayloadButton from './copy-payload-button'
import SelectedPanelHeader from './selected-panel-header'
import RequirementWarning from './requirement-warning'
import TiEvidenceCard from './ti-evidence-card'

export default function SelectedDeliveryReadinessPanel({ plan }: { plan: SelectedDeliveryReadinessPlan }) {
    return (
        <div data-ti-selected-delivery-readiness='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <SelectedPanelHeader title={<>Delivery actions · {plan.summary.alerts} alerts · {plan.summary.captures} captures · {plan.summary.destinations} destinations · {plan.summary.caseRoutes} case links</>}>
                <DecisionStatus status={plan.state} />
                <CopyPayloadButton label='Delivery status' payload={plan} />
            </SelectedPanelHeader>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>
                {plan.handoff.route || plan.route ? 'Delivery action available.' : 'Delivery action pending.'}
            </p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.nextAction)}</p>
            <div className='mt-2 grid gap-2'>
                {plan.alerts.slice(0, 3).map(alert => (
                    <TiEvidenceCard key={alert.id}>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{alert.title}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    alert {alert.id} · {formatLabel(alert.status)}
                                </p>
                            </div>
                            <span className={sourceHealthChipClass(alert.ready ? 'ready' : 'blocked')}>{alert.ready ? 'ready' : 'syncing'}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                            {alert.captureIds.length ? `${alert.captureIds.length} source row${alert.captureIds.length === 1 ? '' : 's'}` : 'sources syncing'}
                            {alert.destinationIds.length ? ` · ${alert.destinationIds.length} destination${alert.destinationIds.length === 1 ? '' : 's'}` : ' · destination needed'}
                            {alert.casePath ? ` · ${displayRequirementText(alert.casePath)}` : ' · case link pending'}
                        </p>
                        <RequirementWarning items={alert.blockers} limit={3} />
                    </TiEvidenceCard>
                ))}
                {!plan.alerts.length ? (
                    <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-[11px] leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>Generate an alert before opening a case.</p>
                ) : null}
            </div>
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {plan.sourceRefs.destinationIds.slice(0, 3).map(id => (
                    <span key={id} className={sourceHealthChipClass('ready')}>destination {id}</span>
                ))}
                {plan.handoff.request ? <span className={sourceHealthChipClass(plan.handoff.ready ? 'ready' : 'blocked')}>{plan.handoff.request}</span> : null}
            </div>
            {plan.blockers.length ? (
                <RequirementWarning items={plan.blockers} limit={4} spacing='mt-2' />
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Alert, capture, destination, and case link refs are ready for authenticated dry-run delivery.</p>
            )}
        </div>
    )
}
