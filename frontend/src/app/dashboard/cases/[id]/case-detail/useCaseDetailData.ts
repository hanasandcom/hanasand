import { useCallback, useEffect, useState } from 'react'
import type { CaseDetail, CaseExport, CaseDetailLoadState } from './contracts'
import type { DeliveryRow, ReceiverReceipt, WebhookDestination } from './evidenceTypes'
import { DWM_CASE_REPORT_MAX_EVIDENCE } from './constants'
import { deliveryContextFromApi, deliveryRowsFromApi, destinationRowsFromApi, orderCaseDeliveries, receiverReceiptRowsFromApi } from './apiData'
import { queryString, resolvedAlertId, resolvedOrganizationId } from './model'

export function useCaseDetailData({ caseId, tenantId, organizationId, alertId, initialDetail, initialExportPayload }: {
    caseId: string
    tenantId: string
    organizationId?: string
    alertId?: string
    initialDetail?: CaseDetail
    initialExportPayload?: CaseExport
}) {
    const [state, setState] = useState<CaseDetailLoadState>({
        loading: !initialDetail,
        detail: initialDetail,
        exportPayload: initialExportPayload,
    })
    const [owner, setOwner] = useState(initialDetail?.case?.assignedOwner || initialDetail?.workflowState?.assignedOwner || '')
    const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([])
    const [showAllEvidenceRows, setShowAllEvidenceRows] = useState(false)
    const [selectedDestinationId, setSelectedDestinationId] = useState('')

    const load = useCallback(async () => {
        setState(previous => ({ ...previous, loading: true, error: undefined }))
        try {
            const query = queryString({ tenantId, organizationId, alertId })
            const [detailResponse, exportResponse] = await Promise.all([
                fetch(`/api/cases/${encodeURIComponent(caseId)}${query}`, { cache: 'no-store' }),
                fetch(`/api/cases/${encodeURIComponent(caseId)}/export${queryString({ tenantId, organizationId, alertId, shape: 'full' })}`, { cache: 'no-store' }),
            ])
            const detailPayload = await detailResponse.json().catch(() => ({}))
            const exportPayload = await exportResponse.json().catch(() => ({}))
            if (!detailResponse.ok) throw new Error(detailPayload.error?.message || detailResponse.statusText)
            const scopedOrganizationId = resolvedOrganizationId(detailPayload.case, organizationId)
            const scopedAlertId = resolvedAlertId(detailPayload.case, detailPayload.alertContext, alertId)
            const related = scopedOrganizationId && scopedAlertId
                ? await loadWebhookContext(scopedOrganizationId, scopedAlertId, caseId)
                : emptyWebhookContext()
            const { deliveries, ...context } = related
            const orderedDeliveries = orderCaseDeliveries(deliveries)
            const detail = {
                ...detailPayload,
                deliveries: orderedDeliveries,
                deliveryContext: deliveryContextFromApi(orderedDeliveries),
            }
            const canonicalExport = exportResponse.ok ? { ...exportPayload, deliveryEvidence: orderedDeliveries } : undefined
            setState({ loading: false, detail, exportPayload: canonicalExport, ...context })
            const availableIds = (detailPayload.evidence || exportPayload.evidenceSummary || [])
                .map((row: { id?: string }) => row.id)
                .filter(Boolean)
                .slice(0, DWM_CASE_REPORT_MAX_EVIDENCE) as string[]
            setSelectedEvidenceIds(previous => previous.filter(id => availableIds.includes(id)))
            setSelectedDestinationId(previous => related.destinations.some(destination => destination.id === previous) ? previous : '')
            setOwner(detailPayload.case?.assignedOwner || detailPayload.workflowState?.assignedOwner || '')
        } catch (error) {
            setState({ loading: false, error: error instanceof Error ? error.message : 'Case detail failed to load.' })
        }
    }, [alertId, caseId, organizationId, tenantId])

    useEffect(() => { void load() }, [load])

    return {
        state, setState, load, owner, setOwner, selectedEvidenceIds, setSelectedEvidenceIds,
        showAllEvidenceRows, setShowAllEvidenceRows, selectedDestinationId, setSelectedDestinationId,
    }
}

async function loadWebhookContext(organizationId: string, alertId: string, caseId: string) {
    const [deliveryResponse, destinationResponse, receiverResponse] = await Promise.all([
        fetch(`/api/findings/webhooks/deliveries${queryString({ organizationId, alertId, reportCaseId: caseId })}`, { cache: 'no-store' }),
        fetch(`/api/organizations/${encodeURIComponent(organizationId)}/webhooks`, { cache: 'no-store' }),
        fetch(`/api/findings/webhook-sink${queryString({ orgId: organizationId, reportCaseId: caseId })}`, { cache: 'no-store' }),
    ])
    const [deliveryPayload, destinationPayload, receiverPayload] = await Promise.all([
        deliveryResponse.json().catch(() => ({})),
        destinationResponse.json().catch(() => ({})),
        receiverResponse.json().catch(() => ({})),
    ])
    const deliveries: DeliveryRow[] = deliveryResponse.ok
        ? deliveryRowsFromApi(deliveryPayload).filter(row => row.thirdPartyReport === true && row.reportCaseId === caseId)
        : []
    return {
        deliveryError: deliveryResponse.ok ? undefined : deliveryPayload.error?.message || deliveryPayload.error || 'Canonical delivery history is unavailable.',
        destinationError: destinationResponse.ok ? undefined : destinationPayload.error?.message || destinationPayload.error || 'Configured destinations are unavailable.',
        receiverError: receiverResponse.ok ? undefined : receiverPayload.error?.message || receiverPayload.error || 'Durable receiver history is unavailable.',
        destinations: destinationResponse.ok ? destinationRowsFromApi(destinationPayload) : [] as WebhookDestination[],
        receiverReceipts: receiverResponse.ok ? receiverReceiptRowsFromApi(receiverPayload) : [] as ReceiverReceipt[],
        deliveries,
    }
}

function emptyWebhookContext() {
    return { deliveryError: undefined, receiverError: undefined, destinationError: undefined, destinations: [], receiverReceipts: [], deliveries: [] as DeliveryRow[] }
}
