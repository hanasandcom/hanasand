import { useEffect, useRef, useState } from 'react'
import { loadActors, loadCases, watchlistItems } from './searchData'
import type { SearchItem } from './types'

export function useSearchData(open: boolean, token: boolean, query: string) {
    const [cases, setCases] = useState<SearchItem[]>([])
    const [actors, setActors] = useState<SearchItem[]>([])
    const [savedSearches, setSavedSearches] = useState<SearchItem[]>([])
    const [watchTerms, setWatchTerms] = useState<SearchItem[]>([])
    const [loading, setLoading] = useState(false)
    const [casesLoading, setCasesLoading] = useState(false)
    const casesLoadedAt = useRef(0)

    useEffect(() => {
        if (!open) return
        try {
            const stored = JSON.parse(window.localStorage.getItem('hanasand:ti:saved-searches') || '[]')
            setSavedSearches(Array.isArray(stored)
                ? stored
                    .filter((item): item is { query: string } => Boolean(item && typeof item.query === 'string'))
                    .map(item => ({
                        id: `saved:${item.query}`,
                        title: item.query,
                        detail: 'Saved search',
                        href: `/ti/${encodeURIComponent(item.query)}`,
                    }))
                : [])
        } catch {
            setSavedSearches([])
        }
        if (!token) return
        fetch('/api/findings/watchlists', { cache: 'no-store' })
            .then(response => response.ok ? response.json() : null)
            .then(payload => setWatchTerms(watchlistItems(payload)))
            .catch(() => setWatchTerms([]))
    }, [open, token])

    useEffect(() => {
        if (!open || !token) {
            casesLoadedAt.current = 0
            setCases([])
            setCasesLoading(false)
            return
        }
        if (casesLoadedAt.current) return
        const controller = new AbortController()
        setCasesLoading(true)
        loadCases(controller.signal).then(items => {
            if (controller.signal.aborted) return
            setCases(items)
            casesLoadedAt.current = Date.now()
        }).catch(() => {
            if (!controller.signal.aborted) setCases([])
        }).finally(() => {
            if (!controller.signal.aborted) setCasesLoading(false)
        })
        return () => controller.abort()
    }, [open, token])

    useEffect(() => {
        if (!open || query.length < 2) {
            setActors([])
            setLoading(false)
            return
        }
        const controller = new AbortController()
        const timer = window.setTimeout(async () => {
            setLoading(true)
            try {
                setActors(await loadActors(query, controller.signal))
            } catch {
                if (!controller.signal.aborted) setActors([])
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }, 220)
        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [open, query])

    return { cases, actors, savedSearches, watchTerms, loading, casesLoading }
}
