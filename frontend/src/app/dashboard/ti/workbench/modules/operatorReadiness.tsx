import type { WorkbenchOrgContext, WorkbenchCase, CaseDetailState, WorkbenchDeliveryEvidence, WorkbenchWorkflowStep } from '../types'
import { label, relativeTime, workflowStatusClass } from './presentation'
import { sanitizeWorkbenchCopy } from './copy'

export function OperatorReadinessRows({ orgContext, selected, caseDetail, actionDeliveries }: { orgContext?: WorkbenchOrgContext, selected?: WorkbenchCase, caseDetail?: CaseDetailState, actionDeliveries?: WorkbenchDeliveryEvidence[] }) {
    const latestDetailDelivery = caseDetail?.status === 'ready' ? caseDetail.detail.deliveryContext?.latestDelivery : undefined
    const latestDelivery = latestDetailDelivery || actionDeliveries?.[0] || selected?.deliveryEvidence?.[0] || orgContext?.readiness.latestDelivery
    const destination = (orgContext?.webhookDestinations || []).find(item => item.id === latestDelivery?.webhookDestinationId) || orgContext?.webhookDestinations[0]
    const sourceCoverage = orgContext?.readiness.sourceCoverage
    const detailAlert = caseDetail?.status === 'ready' ? caseDetail.detail.alert : undefined
    const sourceValue = detailAlert?.sourceFamily
        ? `${label(detailAlert.sourceFamily)} · ${detailAlert.sourceCount ?? selected?.sourceLabel ?? 'source count syncing'}`
        : sourceCoverage
            ? `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active · ${sourceCoverage.watchlistMatchCount} matches`
            : selected?.sourceLabel || 'source coverage syncing'
    const sourceTone: WorkbenchWorkflowStep['status'] = detailAlert?.sourceFamily || (sourceCoverage && sourceCoverage.activeSourceCount > 0) ? 'ready' : 'blocked'
    const webhookValue = destination
        ? `${destination.name} · ${destination.status}${destination.lastTestStatus ? ` · test ${destination.lastTestStatus}` : ''}`
        : 'destination pending'
    const webhookTone: WorkbenchWorkflowStep['status'] = destination?.status === 'active' ? destination.lastTestStatus === 'failed' ? 'blocked' : 'ready' : 'blocked'
    const deliveryValue = latestDelivery
        ? `${latestDelivery.id} · ${latestDelivery.status} · ${relativeTime(latestDelivery.attemptedAt)}`
        : 'no delivery sent'
    const deliveryTone: WorkbenchWorkflowStep['status'] = latestDelivery ? latestDelivery.status === 'failed' || latestDelivery.status === 'skipped' ? 'blocked' : 'ready' : 'needs_action'

    return (
        <>
            <OperatorRow label='Webhook' value={webhookValue} tone={webhookTone} />
            <OperatorRow label='Last delivery' value={deliveryValue} tone={deliveryTone} />
            <OperatorRow label='Source health' value={sourceValue} tone={sourceTone} />
        </>
    )
}

export function OperatorRow({ label: rowLabel, value, tone }: { label: string, value: string, tone: WorkbenchWorkflowStep['status'] }) {
    const cleanLabel = sanitizeWorkbenchCopy(rowLabel) || rowLabel
    const cleanValue = sanitizeWorkbenchCopy(value) || value
    return (
        <div className='flex flex-wrap items-start justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 sm:items-center'>
            <span className='font-semibold text-ui-text '>{cleanLabel}</span>
            <span className='flex min-w-0 flex-wrap items-center justify-end gap-2 text-right text-ui-muted '>
                <span className='min-w-0 break-all'>{cleanValue}</span>
                <span className={`${workflowStatusClass(tone)} shrink-0`}>{label(tone)}</span>
            </span>
        </div>
    )
}
