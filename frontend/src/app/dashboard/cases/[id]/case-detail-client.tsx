'use client'

import Link from '@/components/organizations/workspaceLink'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CaseAction, CaseDetail, CaseExport } from './case-detail/contracts'
import { primaryActions } from './case-detail/constants'
import { CaseDetailWorkspace } from './case-detail/CaseDetailWorkspace'
import { useCaseDetailActions } from './case-detail/useCaseDetailActions'
import { useCaseDetailData } from './case-detail/useCaseDetailData'
import { compactCaseReference, deliveryRetryBlockedReason, queryString, resolvedAlertId, resolvedOrganizationId, resolvedTenantId, thirdPartyReportHref, webhookActionBlockedReason } from './case-detail/model'
import { orderCaseDeliveries } from './case-detail/apiData'

export function DwmCaseDetailClient({ caseId, tenantId, organizationId, alertId, initialDetail, initialExportPayload }: {
    caseId: string
    tenantId: string
    organizationId?: string
    alertId?: string
    initialDetail?: CaseDetail
    initialExportPayload?: CaseExport
}) {
    const data = useCaseDetailData({ caseId, tenantId, organizationId, alertId, initialDetail, initialExportPayload })
    const { state } = data
    const [busy, setBusy] = useState<string | null>(null)
    const [message, setMessage] = useState<{ ok: boolean, text: string } | null>(null)
    const [note, setNote] = useState('')
    const [aiResolution, setAiResolution] = useState(false)
    const caseRecord = state.detail?.case
    const alertContext = state.detail?.alertContext
    const alert = state.detail?.alert
    const actions = useMemo(() => {
        const available = state.detail?.workflowActionPolicy?.actions?.length
            ? state.detail.workflowActionPolicy.actions
            : state.detail?.nextAllowedActions || []
        return primaryActions.map(id => available.find(action => action.id === id) || {
            id, enabled: false, disabledReason: 'Action is not available for this case.',
        }) as CaseAction[]
    }, [state.detail])
    const actionHandlers = useCaseDetailActions({
        caseId, tenantId, organizationId, alertId, state, owner: data.owner, note, aiResolution,
        selectedDestinationId: data.selectedDestinationId, selectedEvidenceIds: data.selectedEvidenceIds,
        busy, setBusy, setMessage, setAiResolution, load: data.load,
    })

    if (state.loading && !state.detail) return <LoadingCase />
    if (state.error || !state.detail || !caseRecord) return <UnavailableCase error={state.error} organizationId={organizationId} />

    const detail = state.detail
    const timeline = detail.timeline || state.exportPayload?.timelineSummary || []
    const evidence = detail.evidence || state.exportPayload?.evidenceSummary || []
    const deliveries = orderCaseDeliveries(detail.deliveries || state.exportPayload?.deliveryEvidence || [])
    const latestDelivery = deliveries[0]
    const latestReceiverReceipt = (state.receiverReceipts || []).find(receipt => Boolean(receipt.deliveryId)
        && receipt.destinationId === (latestDelivery?.webhookDestinationId || latestDelivery?.destinationId)
        && (receipt.deliveryId === latestDelivery?.id || Boolean(receipt.idempotencyKey
            && receipt.idempotencyKey === latestDelivery?.idempotencyKey
            && deliveries.some(delivery => delivery.id === receipt.deliveryId && delivery.status === 'delivered'))))
    const readOnly = Boolean(detail.access?.readOnly || detail.workflowActionPolicy?.summary?.readOnly)
    const scopedTenantId = resolvedTenantId(caseRecord, tenantId)
    const scopedOrganizationId = resolvedOrganizationId(caseRecord, organizationId)
    const scopedAlertId = resolvedAlertId(caseRecord, alertContext, alertId)
    const retryable = latestDelivery?.status === 'failed' && latestDelivery.retryable === true
    const retryBlocked = retryable ? deliveryRetryBlockedReason(latestDelivery) : undefined
    const destinationBlocked = !retryable && !data.selectedDestinationId
        ? state.destinationError || (state.destinations?.length ? 'Select one configured external receiver before delivery.' : 'Webhook delivery needs an active customer destination before it can be tested or sent.')
        : undefined
    const webhookBlockedReason = webhookActionBlockedReason(detail, scopedAlertId) || retryBlocked || destinationBlocked
    const caseMeta = [compactCaseReference(caseRecord.id, 'Case'), compactCaseReference(scopedOrganizationId, 'Org') || 'Org pending', compactCaseReference(scopedAlertId, 'Alert') || 'Alert pending'].join(' · ')
    const reportJsonHref = thirdPartyReportHref(caseRecord.id, scopedTenantId, scopedOrganizationId, scopedAlertId, data.selectedEvidenceIds, 'json')
    const reportStixHref = thirdPartyReportHref(caseRecord.id, scopedTenantId, scopedOrganizationId, scopedAlertId, data.selectedEvidenceIds, 'stix')

    return <CaseDetailWorkspace
        data={{ caseId, caseRecord, detail, state, exportPayload: state.exportPayload, alert, organizationId: scopedOrganizationId, returnOrganizationId: organizationId, alertId: scopedAlertId, caseMeta, evidence, timeline, latestDelivery, latestReceiverReceipt, readOnly, reportJsonHref, reportStixHref }}
        evidenceControls={{ selectedEvidenceIds: data.selectedEvidenceIds, setSelectedEvidenceIds: data.setSelectedEvidenceIds, showAllEvidenceRows: data.showAllEvidenceRows, setShowAllEvidenceRows: data.setShowAllEvidenceRows }}
        workflowControls={{ actions, owner: data.owner, setOwner: data.setOwner, note, setNote, aiResolution, setAiResolution, busy, message, runAction: actionHandlers.runAction, notifyCustomer: actionHandlers.notifyCustomer }}
        deliveryControls={{ selectedDestinationId: data.selectedDestinationId, setSelectedDestinationId: data.setSelectedDestinationId, webhookBlockedReason, sendWebhook: actionHandlers.sendWebhook, copySummary: () => void navigator.clipboard?.writeText(state.exportPayload?.copyText || '').catch(() => undefined) }}
    />
}

function LoadingCase() {
    return <main className='grid min-h-[70vh] place-items-center rounded-lg border border-ui-border bg-ui-canvas text-ui-text'>
        <div className='flex items-center gap-3 text-sm font-semibold'><Loader2 className='h-4 w-4 animate-spin text-ui-loader' />Loading case</div>
    </main>
}

function UnavailableCase({ error, organizationId }: { error?: string, organizationId?: string }) {
    return <main className='rounded-lg border border-ui-danger/30 bg-ui-raised/10 p-5 text-ui-text'>
        <Link href={`/cases${queryString({ organizationId })}`} className='inline-flex items-center gap-2 text-xs font-semibold text-ui-text'><ArrowLeft className='h-4 w-4' />Back to cases</Link>
        <h1 className='mt-4 text-xl font-semibold'>Case unavailable</h1>
        <p className='mt-2 max-w-2xl text-sm leading-6 text-ui-text'>{error || 'The case could not be found for this organization.'}</p>
    </main>
}
