import type { SyntheticEvent } from 'react'
import { alertRebuildFromWatchlistOrRequest, hasDurableSourceRequest, postJson } from './workflow-http'
import { readNumber, readNestedString } from './workflow-values'
import { countTerms, workflowTerms } from './workflow-terms'
import type { WorkflowActionContext } from './workflow-action-context'

export function createCollectionActions(context: WorkflowActionContext) {
    const { scope, terms, sourceTarget, setSourceTarget, setBusyAction, setResult, setLastRoute, refreshWorkspace } = context

    async function submitSource(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusyAction('source')
        setResult(null)
        try {
            const source = await postJson('/api/findings/source-requests', {
                ...scope, target: sourceTarget, type: 'telegram_channel', priority: 'high', scope: terms, activate: false,
            })
            if (!source.ok) throw new Error(source.message)
            const duplicateOf = typeof source.duplicateOf === 'string' ? source.duplicateOf : ''
            const requestId = readNestedString(source, ['request', 'id'])
            const sourceId = readNestedString(source, ['source', 'id'])
            if (!hasDurableSourceRequest(requestId, sourceId, duplicateOf)) throw new Error('No durable source request was returned.')
            setResult({ ok: true, message: duplicateOf ? `Already registered as ${duplicateOf}.` : 'Telegram source submitted for review.' })
            setLastRoute({ label: 'Source request', watchTerms: countTerms(terms), sourceCount: duplicateOf ? 0 : 1 })
            setSourceTarget('')
            refreshWorkspace()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function runCollection() {
        setBusyAction('collection')
        setResult(null)
        try {
            const run = await postJson('/api/findings/canary/run', { ...scope, operatorApproval: true, approvedBy: 'dashboard', maxSources: 12, maxTasks: 24 })
            if (!run.ok) throw new Error(run.message)
            const rebuild = await alertRebuildFromWatchlistOrRequest({}, scope)
            const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setResult({ ok: rebuild.ok, message: rebuild.ok ? `Collected ${captureCount} Telegram captures. Matched ${savedAlertCount} events.` : rebuild.message })
            setLastRoute({ label: 'Collection run', watchTerms: countTerms(workflowTerms(terms)), captureCount, alertCount: savedAlertCount })
            refreshWorkspace()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    return { submitSource, runCollection }
}
