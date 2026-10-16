import type { CaseDetailState, CaseMutationInput, LocalDecision, WorkbenchCase, WorkbenchCaseMutationPayload, WorkbenchOrgContext, WorkbenchActionOutcome } from './types'
import type { Dispatch, SetStateAction } from 'react'
import { caseCustomerNotificationHref, deliveredCaseDelivery } from './modules/caseRoutes'
import { caseMutationIdempotencyKey, caseMutationResultMessage, scopeBody } from './modules/actionMessages'
import { readJson } from './modules/payloadParsing'
import type { WorkbenchPersistentAction } from './useWorkbenchActionState'

export function useCaseWorkflowActions(input: {
    orgContext?: WorkbenchOrgContext
    setLocalDecisions: Dispatch<SetStateAction<Record<string, LocalDecision>>>
    setMessage: Dispatch<SetStateAction<WorkbenchActionOutcome | null>>
    runPersistentAction: WorkbenchPersistentAction
    refreshCaseDetail: (itemId: string, href: string, options?: { loading?: boolean }) => Promise<unknown>
}) {
    const { orgContext, setLocalDecisions, setMessage, runPersistentAction, refreshCaseDetail } = input

    async function copyHandoffPayload(item: WorkbenchCase, payload?: unknown) {
        const target = payload || item.handoff || item.actions?.map(action => action.body).filter(Boolean)
        if (!target) { setMessage({ ok: false, text: 'Select an item with a handoff payload before copying.' }); return }
        try {
            await navigator.clipboard.writeText(JSON.stringify(target, null, 2))
            setMessage({ ok: true, text: 'Exact handoff payload copied.', source: 'session_local' })
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : 'Unable to copy handoff payload.' })
        }
    }

    async function runBackedCaseMutation(item: WorkbenchCase, mutation: CaseMutationInput) {
        if (!item.caseDetailHref) {
            setMessage({ ok: false, text: item.missingDependency || 'Open or create the case before applying this workflow action.' })
            return
        }
        await runPersistentAction(`case:${item.id}:${mutation.action}`, async () => {
            const body: WorkbenchCaseMutationPayload = {
                action: mutation.action, actor: 'dashboard', note: mutation.note || undefined,
                assignedOwner: mutation.assignedOwner || undefined,
                idempotencyKey: caseMutationIdempotencyKey(item, mutation),
            }
            const response = await fetch(item.caseDetailHref as string, {
                method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshCaseDetail(item.id, item.caseDetailHref as string, { loading: false })
            setLocalDecisions(current => {
                const next = { ...current }
                delete next[item.id]
                return next
            })
            return caseMutationResultMessage(mutation.action, payload)
        })
    }

    async function recordCustomerNotification(item: WorkbenchCase, note: string, caseDetail?: CaseDetailState) {
        if (!item.caseDetailHref || caseDetail?.status !== 'ready') {
            setMessage({ ok: false, text: item.missingDependency || 'Open the case details before recording customer notification.' })
            return
        }
        const delivery = deliveredCaseDelivery(caseDetail.detail)
        if (!delivery) { setMessage({ ok: false, text: 'Send or verify a webhook delivery before recording customer notification.' }); return }
        const rationale = note.trim()
        if (!rationale) { setMessage({ ok: false, text: 'Customer notification needs decision rationale.' }); return }
        await runPersistentAction(`case:${item.id}:customer_notification`, async () => {
            const response = await fetch(caseCustomerNotificationHref(item.caseDetailHref as string), {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ...scopeBody(orgContext), deliveryMode: 'webhook_delivery', webhookDeliveryId: delivery.id, rationale, actor: 'dashboard' }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshCaseDetail(item.id, item.caseDetailHref as string, { loading: false })
            return payload.receipt?.id ? `Customer notification ${payload.receipt.id} recorded.` : 'Customer notification delivery recorded.'
        })
    }

    return { copyHandoffPayload, runBackedCaseMutation, recordCustomerNotification }
}
