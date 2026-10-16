'use client'

import { CaseDevelopment } from '../../case-development'
import type { CaseAction, CaseDetail, CaseDetailLoadState, CaseExport } from './contracts'
import type { DeliveryRow, EvidenceRow, ReceiverReceipt, TimelineRow } from './evidenceTypes'
import { CaseActionPanel } from './CaseActionPanel'
import { CaseDeliveryPanel, CaseReportPanel } from './CaseDeliveryPanels'
import { CaseEvidenceTimeline } from './CaseEvidenceTimeline'
import { CaseHeader } from './CaseHeader'
import { Metric } from './presentation'
import { relativeTime } from './model'
import type { Dispatch, SetStateAction } from 'react'

export function CaseDetailWorkspace(props: {
    data: {
        caseId: string
        caseRecord: NonNullable<CaseDetail['case']>
        detail: CaseDetail
        state: CaseDetailLoadState
        exportPayload?: CaseExport
        alert?: CaseDetail['alert']
        organizationId?: string
        returnOrganizationId?: string
        alertId?: string
        caseMeta: string
        evidence: EvidenceRow[]
        timeline: TimelineRow[]
        latestDelivery?: DeliveryRow
        latestReceiverReceipt?: ReceiverReceipt
        readOnly: boolean
        reportJsonHref: string
        reportStixHref: string
    }
    evidenceControls: {
        selectedEvidenceIds: string[]
        setSelectedEvidenceIds: Dispatch<SetStateAction<string[]>>
        showAllEvidenceRows: boolean
        setShowAllEvidenceRows: Dispatch<SetStateAction<boolean>>
    }
    workflowControls: {
        actions: CaseAction[]
        owner: string
        setOwner: (owner: string) => void
        note: string
        setNote: (note: string) => void
        aiResolution: boolean
        setAiResolution: (enabled: boolean) => void
        busy: string | null
        message: { ok: boolean, text: string } | null
        runAction: (action: CaseAction) => void
        notifyCustomer: () => void
    }
    deliveryControls: {
        selectedDestinationId: string
        setSelectedDestinationId: (id: string) => void
        webhookBlockedReason?: string
        sendWebhook: (dryRun: boolean) => void
        copySummary: () => void
    }
}) {
    const { data, evidenceControls, workflowControls, deliveryControls } = props
    const { caseId, caseRecord, detail, state, exportPayload, alert, organizationId, returnOrganizationId, alertId, caseMeta, evidence, timeline, latestDelivery, latestReceiverReceipt, readOnly, reportJsonHref, reportStixHref } = data
    return (
        <main className='grid min-w-0 gap-3 text-ui-text'>
            <section className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-canvas'>
                <CaseHeader caseRecord={caseRecord} alert={alert} organizationId={returnOrganizationId} latestDelivery={latestDelivery} deliveryCount={detail.deliveryContext?.deliveryCount || 0} caseMeta={caseMeta} />
                <div className='grid min-w-0 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_320px]'>
                    <section className='grid min-w-0 gap-3'>
                        <CaseDevelopment caseId={caseId} organizationId={organizationId} />
                        <div className='grid gap-2 sm:grid-cols-3'>
                            <Metric label='Evidence' value={`${evidence.length}`} detail={evidence.some(item => item.contentHash || item.provenance?.contentHash) ? 'hashes linked' : 'hashes pending'} />
                            <Metric label='Last activity' value={caseRecord.updatedAt ? relativeTime(caseRecord.updatedAt) : '—'} detail={`${timeline.length} recorded event${timeline.length === 1 ? '' : 's'}`} />
                            <Metric label='Delivery' value={latestDelivery?.status || 'not sent'} detail={latestDelivery ? relativeTime(latestDelivery.attemptedAt) : 'no attempt'} />
                        </div>
                        <CaseEvidenceTimeline evidence={evidence} timeline={timeline} {...evidenceControls} />
                    </section>
                    <aside id='dwm-case-actions' data-dwm-case-action-dock className='order-first grid min-w-0 scroll-mt-24 content-start gap-3 xl:order-none'>
                        <CaseActionPanel detail={detail} actions={workflowControls.actions} readOnly={readOnly} owner={workflowControls.owner} setOwner={workflowControls.setOwner} note={workflowControls.note} setNote={workflowControls.setNote} aiResolution={workflowControls.aiResolution} setAiResolution={workflowControls.setAiResolution} busy={workflowControls.busy} message={workflowControls.message} runAction={workflowControls.runAction} notifyCustomer={workflowControls.notifyCustomer} />
                        <CaseDeliveryPanel organizationId={organizationId} alertId={alertId} state={state} latestDelivery={latestDelivery} latestReceiverReceipt={latestReceiverReceipt} selectedDestinationId={deliveryControls.selectedDestinationId} setSelectedDestinationId={deliveryControls.setSelectedDestinationId} readOnly={readOnly} busy={workflowControls.busy} webhookBlockedReason={deliveryControls.webhookBlockedReason} onSendWebhook={deliveryControls.sendWebhook} />
                        <CaseReportPanel selectedEvidenceIds={evidenceControls.selectedEvidenceIds} exportPayload={exportPayload} alertDedupeKey={alert?.webhookDelivery?.dedupeKey} reportJsonHref={reportJsonHref} reportStixHref={reportStixHref} copySummary={deliveryControls.copySummary} />
                    </aside>
                </div>
            </section>
        </main>
    )
}
