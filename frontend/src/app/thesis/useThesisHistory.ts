'use client'

import { useState } from 'react'
import type { ThesisDocument } from '@/utils/thesis'
import type useThesis from './useThesis'

export type HistoryItem = { revision: number, title: string, saved_at: string, immediate: boolean }
type ThesisState = ReturnType<typeof useThesis>

export default function useThesisHistory(thesis: ThesisState, setBusy: (value: boolean) => void) {
    const [history, setHistory] = useState<HistoryItem[] | null>(null)
    const [preview, setPreview] = useState<ThesisDocument | null>(null)
    const [error, setError] = useState('')
    const [helpOpen, setHelpOpen] = useState(false)
    const [hasMore, setHasMore] = useState(false)

    async function load(older = false) {
        setBusy(true)
        setError('')
        try {
            const before = older && history?.length ? `?before=${history.at(-1)!.revision}` : ''
            const response = await fetch('/api/thesis/history' + before, { cache: 'no-store' })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'History could not be loaded.')
            setHistory(older ? [...(history || []), ...result] : result)
            setHasMore(result.length === 50)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'History could not be loaded.')
        } finally {
            setBusy(false)
        }
    }

    async function readVersion(revision: number): Promise<ThesisDocument> {
        if (preview?.revision === revision) return preview
        const response = await fetch(`/api/thesis/history?revision=${revision}`, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'This version could not be loaded.')
        return result
    }

    async function showVersion(revision: number) {
        if (preview?.revision === revision) {
            setPreview(null)
            return
        }
        setBusy(true)
        setError('')
        try {
            setPreview(await readVersion(revision))
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'This version could not be loaded.')
        } finally {
            setBusy(false)
        }
    }

    async function restore(revision: number) {
        setBusy(true)
        setError('')
        try {
            if (await thesis.restore(await readVersion(revision))) {
                setPreview(null)
                await load()
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'This version could not be restored.')
        } finally {
            setBusy(false)
        }
    }

    return { history, preview, error, helpOpen, setHelpOpen, hasMore, load, showVersion, restore, close: () => setHistory(null) }
}
