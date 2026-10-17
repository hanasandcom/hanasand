import { useCallback, useEffect, useState } from 'react'
import type { AlertDetailState, CaseDetailState, WorkbenchAction, WorkbenchApiPayload, WorkbenchCase, WorkbenchDeliveryEvidence, WorkbenchOrgContext } from './types'
import { caseDetailHrefFromAlertDetail, caseDetailHrefFromPayload } from './modules/actionInputs'
import { deliveryEvidenceFromPayload, mergeDeliveryEvidence, readAlertDetailJson, readSuccessfulCaseDetail } from './modules/payloadParsing'

export function useWorkbenchDetails(selected: WorkbenchCase | undefined, orgContext?: WorkbenchOrgContext) {
    const [caseDetails, setCaseDetails] = useState<Record<string, CaseDetailState>>({})
    const [alertDetails, setAlertDetails] = useState<Record<string, AlertDetailState>>({})
    const [actionDeliveries, setActionDeliveries] = useState<Record<string, WorkbenchDeliveryEvidence[]>>({})

    const refreshCaseDetail = useCallback(async (itemId: string, href: string, options: { loading?: boolean } = {}) => {
        if (options.loading !== false) setCaseDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        const response = await fetch(href, { cache: 'no-store' })
        const payload = await readSuccessfulCaseDetail(response)
        setCaseDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
        return payload
    }, [])

    const refreshAlertDetail = useCallback(async (itemId: string, options: { loading?: boolean } = {}) => {
        if (options.loading !== false) setAlertDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        const response = await fetch(`/api/findings/alerts/${encodeURIComponent(itemId)}`, { cache: 'no-store' })
        const payload = await readAlertDetailJson(response)
        if (!response.ok) throw new Error(payload.error?.message || response.statusText)
        setAlertDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
        return payload
    }, [])

    useEffect(() => {
        if (!selected?.caseDetailHref) return
        let cancelled = false
        const itemId = selected.id
        const href = selected.caseDetailHref
        setCaseDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        fetch(href, { cache: 'no-store' })
            .then(readSuccessfulCaseDetail)
            .then(payload => {
                if (!cancelled) setCaseDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
            })
            .catch(error => {
                if (!cancelled) setCaseDetails(current => ({ ...current, [itemId]: { status: 'error', error: error instanceof Error ? error.message : String(error) } }))
            })
        return () => { cancelled = true }
    }, [selected?.id, selected?.caseDetailHref])

    useEffect(() => {
        if (!selected || selected.kind !== 'dwm_alert' || !selected.persistent) return
        const currentDetail = alertDetails[selected.id]
        if (currentDetail?.status === 'ready' || currentDetail?.status === 'loading') return
        let cancelled = false
        const itemId = selected.id
        setAlertDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        refreshAlertDetail(itemId, { loading: false })
            .then(payload => {
                if (!cancelled) setAlertDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
            })
            .catch(error => {
                if (!cancelled) setAlertDetails(current => ({ ...current, [itemId]: { status: 'error', error: error instanceof Error ? error.message : String(error) } }))
            })
        return () => { cancelled = true }
    }, [alertDetails, refreshAlertDetail, selected])

    useEffect(() => {
        if (!selected || selected.caseDetailHref || selected.kind !== 'dwm_alert') return
        const alertDetail = alertDetails[selected.id]
        if (alertDetail?.status !== 'ready') return
        const href = caseDetailHrefFromAlertDetail(alertDetail.detail, orgContext)
        if (!href) return
        const currentCaseDetail = caseDetails[selected.id]
        if (currentCaseDetail?.status === 'ready' || currentCaseDetail?.status === 'loading') return
        let cancelled = false
        refreshCaseDetail(selected.id, href)
            .catch(error => {
                if (!cancelled) setCaseDetails(current => ({ ...current, [selected.id]: { status: 'error', error: error instanceof Error ? error.message : String(error) } }))
            })
        return () => { cancelled = true }
    }, [alertDetails, caseDetails, orgContext, refreshCaseDetail, selected])

    const refreshBackedSelection = useCallback(async (item: WorkbenchCase, payload?: WorkbenchApiPayload, action?: WorkbenchAction) => {
        const alertDetail = item.kind === 'dwm_alert' && item.persistent ? await refreshAlertDetail(item.id, { loading: false }) : undefined
        const deliveryEvidence = deliveryEvidenceFromPayload(payload, item.id)
        if (deliveryEvidence.length) {
            setActionDeliveries(current => ({ ...current, [item.id]: mergeDeliveryEvidence(deliveryEvidence, current[item.id] || []) }))
        }
        const caseHref = item.caseDetailHref || caseDetailHrefFromPayload(payload, action, orgContext) || caseDetailHrefFromAlertDetail(alertDetail, orgContext)
        if (caseHref) await refreshCaseDetail(item.id, caseHref, { loading: false })
    }, [orgContext, refreshAlertDetail, refreshCaseDetail])

    return { caseDetails, alertDetails, actionDeliveries, setCaseDetails, setAlertDetails, setActionDeliveries, refreshCaseDetail, refreshAlertDetail, refreshBackedSelection }
}
