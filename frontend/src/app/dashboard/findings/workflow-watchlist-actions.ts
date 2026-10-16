import type { SyntheticEvent } from 'react'
import { countTerms, workflowTerms } from './workflow-terms'
import { postJson } from './workflow-http'
import type { WorkflowActionContext } from './workflow-action-context'

export function createWatchlistActions(context: WorkflowActionContext) {
    const { scope, variant, watchlistId, webhookUrl, terms, setTerms, setBusyAction, setResult, setLastRoute, refreshWorkspace, onSaved } = context

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
        setBusyAction('watchlist')
        setResult(null)
        const nextTerms = workflowTerms(terms)
        try {
            const saved = await saveTerms(nextTerms)
            if (!saved.ok) throw new Error(saved.message)
            setTerms(nextTerms)
            setResult({ ok: true, message: 'Watchlist terms saved. New findings will be checked against them.' })
            setLastRoute({ label: 'Watchlist', watchTerms: countTerms(nextTerms) })
            refreshWorkspace()
            onSaved?.()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function save(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusyAction('watchlist')
        setResult(null)
        const nextTerms = workflowTerms(terms)
        try {
            const saved = await saveTerms(nextTerms)
            if (!saved.ok) throw new Error(saved.message)
            setTerms(nextTerms)
            setResult({ ok: true, message: 'Watchlist terms saved.' })
            if (variant !== 'watchlist-editor') refreshWorkspace()
            onSaved?.()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    return { save, saveFromCommand, saveTerms }
}
