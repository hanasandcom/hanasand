import type { AlertDetailState, LocalDecision, WorkbenchAction, WorkbenchActionOutcome, WorkbenchApiPayload, WorkbenchCase, WorkbenchOrgContext } from './types'
import type { Dispatch, SetStateAction } from 'react'
import { alertWorkflowMutationBody, scopedActionBody, scopedDeliveryActionBody, sendDeliveryActionFor, sendDeliveryDisabledReason } from './modules/actionInputs'
import { alertReplayResultMessage, actionResultMessage, webhookDeliveryResultMessage } from './modules/actionMessages'
import { mapDwmDecision } from './modules/watchlistHelpers'
import { readJson } from './modules/payloadParsing'
import { label } from './modules/presentation'
import type { WorkbenchPersistentAction } from './useWorkbenchActionState'

export function useAlertWorkflowActions(input: {
    orgContext?: WorkbenchOrgContext
    alertDetails: Record<string, AlertDetailState>
    localDecisions: Record<string, LocalDecision>
    setLocalDecisions: Dispatch<SetStateAction<Record<string, LocalDecision>>>
    setMessage: Dispatch<SetStateAction<WorkbenchActionOutcome | null>>
    runPersistentAction: WorkbenchPersistentAction
    refreshBackedSelection: (item: WorkbenchCase, payload?: WorkbenchApiPayload, action?: WorkbenchAction) => Promise<void>
}) {
    const { orgContext, alertDetails, localDecisions, setLocalDecisions, setMessage, runPersistentAction, refreshBackedSelection } = input

    async function applyDecision(item: WorkbenchCase, decision: LocalDecision) {
        const nextDecision = { ...(localDecisions[item.id] ?? {}), ...decision, decidedAt: new Date().toISOString() }
        const decisionStatus = decision.status
        if (item.kind !== 'dwm_alert' || (!decisionStatus && !decision.owner)) {
            setLocalDecisions(current => ({ ...current, [item.id]: nextDecision }))
            return
        }
        await runPersistentAction(`decision:${item.id}`, async () => {
            const mapped: Partial<{ reviewState: string, deliveryState: string }> = decisionStatus ? mapDwmDecision(decisionStatus, item.status) : {}
            const currentAlertDetail = alertDetails[item.id]
            const mutationDetail = currentAlertDetail?.status === 'ready' ? currentAlertDetail.detail : undefined
            const response = await fetch(`/api/findings/alerts/${encodeURIComponent(item.id)}`, {
                method: 'PATCH', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    ...alertWorkflowMutationBody(item, mutationDetail, orgContext),
                    reviewState: mapped.reviewState, deliveryState: mapped.deliveryState,
                    note: decision.reason || (decision.owner ? `Assigned to ${decision.owner}.` : 'Updated from recent attacks.'),
                    assignedOwner: decision.owner, actor: 'dashboard',
                }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setLocalDecisions(current => ({ ...current, [item.id]: nextDecision }))
            await refreshBackedSelection(item, payload)
            return decisionStatus ? `${label(decisionStatus)} saved to the dark web case.` : 'Owner saved to the dark web case.'
        })
    }

    async function replayDwmAlert(item: WorkbenchCase) {
        await runPersistentAction(`replay:${item.id}`, async () => {
            const currentAlertDetail = alertDetails[item.id]
            const mutationDetail = currentAlertDetail?.status === 'ready' ? currentAlertDetail.detail : undefined
            const response = await fetch(`/api/findings/alerts/${encodeURIComponent(item.id)}/replay`, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ...alertWorkflowMutationBody(item, mutationDetail, orgContext), action: 'replay', actor: 'dashboard' }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshBackedSelection(item, payload)
            return alertReplayResultMessage(payload, item)
        })
    }

    async function sendDwmAlert(item: WorkbenchCase) {
        const disabledReason = sendDeliveryDisabledReason(item, orgContext)
        if (disabledReason) { setMessage({ ok: false, text: disabledReason }); return }
        await runPersistentAction(`send:${item.id}`, async () => {
            const action = sendDeliveryActionFor(item)
            const response = await fetch(action?.href || '/api/findings/webhooks/deliver', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopedDeliveryActionBody(action?.body || { alertId: item.id, limit: 1 }, orgContext)),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshBackedSelection(item, payload, action)
            return webhookDeliveryResultMessage(payload)
        })
    }

    async function runWorkbenchAction(item: WorkbenchCase, action: WorkbenchAction, note: string) {
        if (action.method === 'GET') return
        if (action.disabledReason) { setMessage({ ok: false, text: action.disabledReason }); return }
        await runPersistentAction(`action:${item.id}:${action.id}`, async () => {
            const body = {
                ...scopedActionBody(action.body || {}, orgContext),
                note: note || action.body?.note,
                assignedOwner: localDecisions[item.id]?.owner,
                actor: 'dashboard',
            }
            const response = await fetch(action.href, {
                method: action.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshBackedSelection(item, payload, action)
            return actionResultMessage(action, payload)
        })
    }

    return { applyDecision, replayDwmAlert, sendDwmAlert, runWorkbenchAction }
}
