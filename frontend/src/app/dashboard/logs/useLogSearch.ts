'use client'

import { useEffect, useRef, useState } from 'react'
import { logSearchParams, type LogEvent, type LogSearchResult } from '@/utils/logs/search'
import { retainEvents } from '@/utils/logs/retainEvents'
import type { ErrorEventsResponse } from '@/utils/logs/types'

type LogsView = 'dashboard' | 'realtime' | 'search' | 'errors'

export function useLogSearch({ view, hours, advanced, appliedHql, table, search, service, severity, refresh, initialData, initialError, onErrorsLoaded }: {
    view: LogsView
    hours: string
    advanced: boolean
    appliedHql: string
    table: string
    search: string
    service: string
    severity: string
    refresh: number
    initialData: LogSearchResult | null
    initialError: string
    onErrorsLoaded: (errors: ErrorEventsResponse) => void
}) {
    const [data, setData] = useState<LogSearchResult | null>(initialData)
    const [error, setError] = useState(initialError)
    const [busy, setBusy] = useState(false)
    const [paged, setPaged] = useState(false)
    const loadMore = useRef<(cursor: string) => void>(() => {})
    const queryIdentity = useRef(JSON.stringify([view, service, search, table, advanced, appliedHql, hours, severity]))

    useEffect(() => {
        const identity = JSON.stringify([view, service, search, table, advanced, appliedHql, hours, severity])
        const sameQuery = queryIdentity.current === identity
        if (!sameQuery) { setData(null); setError(''); queryIdentity.current = identity }
        setBusy(false)
        setPaged(false)
        const controller = new AbortController()
        let inFlight = false
        let browsingPages = false

        async function load(cursor?: string) {
            if (inFlight) return
            inFlight = true
            setBusy(true)
            const params = logSearchParams({ view, hours, advanced, appliedHql, table, search, service, severity })
            if (cursor) params.set('cursor', cursor)
            try {
                const response = await fetch(view === 'errors' ? '/api/backend/logs/errors?limit=150' : `/api/backend/logs/search?${params}`, { signal: controller.signal, cache: 'no-store' })
                const body = await response.json().catch(() => ({}))
                if (!response.ok) throw new Error(body.error || 'Could not search logs.')
                if (!controller.signal.aborted) {
                    if (view === 'errors') onErrorsLoaded(body)
                    else setData(previous => mergeLogPage({ body, previous, cursor, browsingPages, view }))
                    if (cursor) { browsingPages = true; setPaged(true) }
                    setError('')
                }
            } catch (cause) {
                if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load logs.')
            } finally {
                if (!controller.signal.aborted) setBusy(false)
                inFlight = false
            }
        }

        const debounce = sameQuery && refresh === 0 ? undefined : setTimeout(() => void load(), 250)
        if (sameQuery && refresh === 0) void load()
        loadMore.current = cursor => void load(cursor)
        const interval = view !== 'errors' && view !== 'search'
            ? setInterval(() => void load(), view === 'realtime' ? 10_000 : 5000) : undefined
        return () => { controller.abort(); clearTimeout(debounce); clearInterval(interval); loadMore.current = () => {} }
    }, [view, service, search, table, advanced, appliedHql, hours, severity, refresh, initialData, onErrorsLoaded])

    return { data, error, setError, busy, paged, loadMore: (cursor: string) => loadMore.current(cursor) }
}

function mergeLogPage({ body, previous, cursor, browsingPages, view }: {
    body: LogSearchResult
    previous: LogSearchResult | null
    cursor?: string
    browsingPages: boolean
    view: LogsView
}): LogSearchResult {
    if (cursor && previous) {
        const seen = new Set(previous.rows.map(row => row.id))
        return { ...body, total_events: body.total_events ?? previous.total_events, rows: [...previous.rows, ...body.rows.filter(row => !seen.has(row.id))] }
    }
    // Keep the pages being read in place while progress keeps refreshing.
    if (browsingPages && previous) return { ...previous, processing: body.processing, generated_at: body.generated_at, total_events: body.total_events }
    return view === 'realtime' && !body.summarize
        ? { ...body, rows: retainEvents((previous?.rows || []).filter(isRealtimeSeverity), body.rows.filter(isRealtimeSeverity)) }
        : body
}

function isRealtimeSeverity(event: LogEvent) {
    return event.normalized.severity === 'high' || event.normalized.severity === 'critical'
}
