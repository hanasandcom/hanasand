import type { Dispatch, SetStateAction } from 'react'
import type { CaseAction, CaseDetailLoadState } from './contracts'
import type { DeliveryRow } from './evidenceTypes'
import { orderCaseDeliveries } from './apiData'
import { actionLabel, deliveryRetryBlockedReason, resolvedAlertId, resolvedOrganizationId, resolvedTenantId, webhookActionBlockedReason } from './model'

export function useCaseDetailActions({ caseId, tenantId, organizationId, alertId, state, owner, note, aiResolution, selectedDestinationId, selectedEvidenceIds, busy, setBusy, setMessage, setAiResolution, load }: {
    caseId: string
    tenantId: string
    organizationId?: string
    alertId?: string
    state: CaseDetailLoadState
    owner: string
    note: string
    aiResolution: boolean
    selectedDestinationId: string
    selectedEvidenceIds: string[]
    busy: string | null
    setBusy: Dispatch<SetStateAction<string | null>>
    setMessage: Dispatch<SetStateAction<{ ok: boolean, text: string } | null>>
    setAiResolution: Dispatch<SetStateAction<boolean>>
    load: () => Promise<void>
}) {
    const caseRecord = state.detail?.case
    const alertContext = state.detail?.alertContext

    async function runAction(action: CaseAction) {
        if (!action.enabled || busy) return
        const actionId = action.id
        const rationale = note.trim()
        if (action.requiresRationale && !rationale) {
            setMessage({ ok: false, text: 'Add a reason before changing the case.' })
            return
        }
        if (actionId === 'assign' && !owner.trim()) {
            setMessage({ ok: false, text: 'Set an owner before assigning the case.' })
            return
        }
        setBusy(actionId)
        setMessage(null)
        try {
            const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    tenantId: resolvedTenantId(caseRecord, tenantId),
                    organizationId: resolvedOrganizationId(caseRecord, organizationId),
                    alertId: resolvedAlertId(caseRecord, alertContext, alertId),
                    action: actionId,
                    ...(actionId === 'confirm_resolution' ? { confirmResolutionId: caseRecord?.resolution?.id } : {}),
                    ...(actionId === 'close' && aiResolution ? { resolutionMethod: 'ai' } : {}),
                    note: rationale,
                    assignedOwner: owner.trim() || undefined,
                    idempotencyKey: `dashboard-case:${caseId}:${actionId}:${caseRecord?.updatedAt || caseRecord?.createdAt || 'initial'}`,
                }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            if (!payload.case || typeof payload.case.id !== 'string') throw new Error('No durable case update was returned.')
            setMessage({ ok: true, text: `${actionLabel(actionId)} recorded.` })
            setAiResolution(false)
            await load()
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : 'Case action failed.' })
        } finally {
            setBusy(null)
        }
    }

    async function notifyCustomer() {
        if (busy) return
        if (!note.trim()) {
            setMessage({ ok: false, text: 'Add a customer-safe note before recording a notification dry run.' })
            return
        }
        setBusy('notify')
        setMessage(null)
        try {
            const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/customer-notification`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    tenantId: resolvedTenantId(caseRecord, tenantId),
                    organizationId: resolvedOrganizationId(caseRecord, organizationId),
                    deliveryMode: 'dry_run',
                    note: note.trim(),
                    idempotencyKey: `dashboard-case-notify:${caseId}:${caseRecord?.updatedAt || caseRecord?.createdAt || 'initial'}`,
                }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            if (!payload.receipt || typeof payload.receipt.id !== 'string') throw new Error('No durable notification record was returned.')
            setMessage({ ok: true, text: 'Notification dry run recorded.' })
            await load()
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : 'Notification dry run failed.' })
        } finally {
            setBusy(null)
        }
    }

    async function sendWebhook(dryRun: boolean) {
        const targetAlertId = resolvedAlertId(caseRecord, alertContext, alertId)
        const latestDelivery = orderCaseDeliveries(state.detail?.deliveries || state.exportPayload?.deliveryEvidence || [])[0] as DeliveryRow | undefined
        const retryBlockedReason = !dryRun ? deliveryRetryBlockedReason(latestDelivery) : undefined
        const retryDeliveryId = !dryRun && latestDelivery?.status === 'failed' && latestDelivery.retryable === true && !retryBlockedReason ? latestDelivery.id : undefined
        const blockedReason = webhookActionBlockedReason(state.detail, targetAlertId)
        if (blockedReason) {
            setMessage({ ok: false, text: blockedReason })
            return
        }
        if (retryBlockedReason) {
            setMessage({ ok: false, text: retryBlockedReason })
            return
        }
        if (!retryDeliveryId && !selectedDestinationId) {
            setMessage({ ok: false, text: state.destinationError || 'Select one configured external receiver before delivery.' })
            return
        }
        if (!retryDeliveryId && !selectedEvidenceIds.length) {
            setMessage({ ok: false, text: 'Select at least one evidence row before creating a third-party report.' })
            return
        }
        setBusy(dryRun ? 'webhook-test' : 'webhook-send')
        setMessage(null)
        try {
            const response = await fetch('/api/findings/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(retryDeliveryId ? {
                    organizationId: resolvedOrganizationId(caseRecord, organizationId),
                    deliveryId: retryDeliveryId,
                } : {
                    tenantId: resolvedTenantId(caseRecord, tenantId),
                    organizationId: resolvedOrganizationId(caseRecord, organizationId),
                    alertId: targetAlertId,
                    caseId,
                    evidenceIds: selectedEvidenceIds,
                    reportFormat: 'stix',
                    destinationId: selectedDestinationId,
                    dryRun,
                }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(payload.error?.message || payload.error || response.statusText)
            const delivery = Array.isArray(payload.deliveries) ? payload.deliveries[0] as DeliveryRow | undefined : undefined
            if (!delivery) throw new Error('No durable delivery result was returned.')
            await load()
            if (delivery.status === 'failed' || delivery.status === 'skipped') throw new Error(delivery.error || `Report delivery was ${delivery.status}.`)
            if (dryRun && delivery.status !== 'dry_run') throw new Error(`Expected a dry-run result, received ${delivery.status || 'unknown'}.`)
            if (!dryRun && delivery.status !== 'delivered') throw new Error(`Report was not delivered; durable status is ${delivery.status || 'unknown'}.`)
            setMessage({ ok: true, text: dryRun ? 'STIX report dry run recorded.' : 'STIX report delivered to the external receiver.' })
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : 'Webhook delivery failed.' })
        } finally {
            setBusy(null)
        }
    }

    return { runAction, notifyCustomer, sendWebhook }
}
