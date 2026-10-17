import type { SyntheticEvent } from 'react'
import { countTerms, workflowTerms } from './workflow-terms'
import { postJson } from './workflow-http'
import type { WorkflowActionContext } from './workflow-action-context'
import { runWorkflowAction } from './workflow-action-lifecycle'

export function createWatchlistActions(context: WorkflowActionContext) {
    const { scope, variant, watchlistId, webhookUrl, terms, setTerms, setResult, setLastRoute, refreshWorkspace, onSaved } = context

    function saveTerms(nextTerms: string) {
        return postJson('/api/findings/watchlists', {
            ...scope,
            ...(variant === 'watchlist-editor' && watchlistId ? { id: watchlistId } : {}),
            name: 'Default company exposure watchlist',
            terms: nextTerms,
            webhookUrl: webhookUrl.trim() || undefined,
        })
    }

    async function saveFromCommand() {
        await runWorkflowAction(context, 'watchlist', async () => {
            const nextTerms = workflowTerms(terms)
            const saved = await saveTerms(nextTerms)
            if (!saved.ok) throw new Error(saved.message)
            setTerms(nextTerms)
            setResult({ ok: true, message: 'Watchlist terms saved. New findings will be checked against them.' })
            setLastRoute({ label: 'Watchlist', watchTerms: countTerms(nextTerms) })
            refreshWorkspace()
            onSaved?.()
        })
    }

    async function save(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        await runWorkflowAction(context, 'watchlist', async () => {
            const nextTerms = workflowTerms(terms)
            const saved = await saveTerms(nextTerms)
            if (!saved.ok) throw new Error(saved.message)
            setTerms(nextTerms)
            setResult({ ok: true, message: 'Watchlist terms saved.' })
            if (variant !== 'watchlist-editor') refreshWorkspace()
            onSaved?.()
        })
    }

    return { save, saveFromCommand, saveTerms }
}
