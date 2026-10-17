import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isManagementSearchShortcut } from '@/utils/isManagementSearchShortcut'
import { getCookie } from '@/utils/cookies/cookies'
import config from '@/config'
import { auditQuery, param, readAuditPage, summarizeAuditFailures, type AuditPage, type AuditSearchParams } from './data'
import { fetchSystemEvents } from './request'

type AuditUiState = {
    searchOpen?: boolean
    filtersOpen?: boolean
    analyticsOpen?: boolean
    openEvent?: number | null
    alertsOpen?: boolean
    hqlSyntaxOpen?: boolean
}

const auditUiStateKey = 'management-audit-ui-state-v1'

export default function useAuditTimeline(initialAudit: AuditPage, filters: AuditSearchParams) {
    const [audit, setAudit] = useState(initialAudit)
    const [activeFilters, setActiveFilters] = useState(filters)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const [searchError, setSearchError] = useState(initialAudit.error || '')
    const [searchOpen, setSearchOpen] = useState(!!(param(filters, 'q') || param(filters, 'hql')))
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [analyticsOpen, setAnalyticsOpen] = useState(false)
    const [alertsOpen, setAlertsOpen] = useState(false)
    const [hqlSyntaxOpen, setHqlSyntaxOpen] = useState(false)
    const [uiStateReady, setUiStateReady] = useState(false)
    const [openEvent, setOpenEvent] = useState<number | null>(null)
    const [mode, setMode] = useState(param(filters, 'hql') ? 'hql' : 'q')
    const [search, setSearch] = useState(param(filters, 'hql') || param(filters, 'q'))
    const [fullscreen, setFullscreen] = useState(false)
    const [showScrollTop, setShowScrollTop] = useState(false)
    const dialog = useRef<HTMLDialogElement>(null)
    const fullscreenButton = useRef<HTMLButtonElement>(null)
    const searchInput = useRef<HTMLInputElement>(null)
    const scrollPosition = useRef(0)
    const pending = useRef(false)
    const controller = useRef<AbortController | null>(null)
    const scrollRoot = useRef<HTMLDivElement>(null)
    const sentinel = useRef<HTMLDivElement>(null)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(auditUiStateKey)
            if (saved) {
                const state = JSON.parse(saved) as AuditUiState
                if (typeof state.searchOpen === 'boolean') setSearchOpen(state.searchOpen)
                if (typeof state.filtersOpen === 'boolean') setFiltersOpen(state.filtersOpen)
                if (typeof state.analyticsOpen === 'boolean') setAnalyticsOpen(state.analyticsOpen)
                if (state.openEvent === null || (typeof state.openEvent === 'number' && Number.isSafeInteger(state.openEvent))) setOpenEvent(state.openEvent)
                if (typeof state.alertsOpen === 'boolean') setAlertsOpen(state.alertsOpen)
                if (typeof state.hqlSyntaxOpen === 'boolean') setHqlSyntaxOpen(state.hqlSyntaxOpen)
            }
        } catch {
            // Keep the page usable when browser storage is unavailable or malformed.
        }
        setUiStateReady(true)
    }, [])

    useEffect(() => {
        if (!uiStateReady) return
        try {
            localStorage.setItem(auditUiStateKey, JSON.stringify({ searchOpen, filtersOpen, analyticsOpen, openEvent, alertsOpen, hqlSyntaxOpen }))
        } catch {
            // Storage can be disabled by the browser; the controls still work for this visit.
        }
    }, [searchOpen, filtersOpen, analyticsOpen, openEvent, alertsOpen, hqlSyntaxOpen, uiStateReady])

    const sortedEvents = audit.events
    const queryResult = audit.queryResult
    const loadEvents = useCallback(async (nextFilters: AuditSearchParams, cursor?: string | null) => {
        controller.current?.abort()
        pending.current = true
        setLoading(true)
        setError(false)
        setSearchError('')
        const abort = new AbortController()
        controller.current = abort
        try {
            const token = getCookie('access_token')
            const id = getCookie('id')
            if (!token || !id) throw new Error('Authentication required')
            const response = await fetchSystemEvents(config.url.api, auditQuery(nextFilters, cursor), token, id, { signal: abort.signal })
            const payload = await response.json()
            if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to load events')
            const result = readAuditPage(payload)
            if (abort.signal.aborted) return
            setAudit(current => {
                const ids = new Set(current.events.map(event => event.id))
                return cursor ? { ...result, total: result.total ?? current.total, events: [...current.events, ...result.events.filter(event => !ids.has(event.id))] } : result
            })
            if (!cursor) {
                setActiveFilters(nextFilters)
                setShowScrollTop(false)
                if (scrollRoot.current) scrollRoot.current.scrollTop = 0
                const url = new URL(window.location.href)
                for (const key of ['q', 'hql']) {
                    const value = param(nextFilters, key)
                    if (value) url.searchParams.set(key, value)
                    else url.searchParams.delete(key)
                }
                window.history.replaceState(null, '', url)
            }
        } catch (cause) {
            if (!abort.signal.aborted) {
                if (cursor) setError(true)
                else setSearchError(`${cause instanceof Error ? cause.message : 'Unable to search events.'} Previous results are still shown.`)
            }
        } finally {
            if (controller.current === abort) {
                pending.current = false
                setLoading(false)
            }
        }
    }, [])

    const loadMore = useCallback(() => {
        if (!pending.current && !searchError && audit.available && audit.nextCursor) void loadEvents(activeFilters, audit.nextCursor)
    }, [audit.available, audit.nextCursor, activeFilters, loadEvents, searchError])
    useEffect(() => () => controller.current?.abort(), [])
    useEffect(() => {
        if (!sentinel.current || error || loading || !audit.nextCursor) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) loadMore()
        }, { root: scrollRoot.current, rootMargin: '150px' })
        observer.observe(sentinel.current)
        return () => observer.disconnect()
    }, [loadMore, error, loading, audit.nextCursor, fullscreen])

    const updateScrollTopButton = useCallback(() => {
        const root = scrollRoot.current
        const fiftiethRow = root?.querySelector('tbody > tr:nth-child(50)')
        const headerHeight = root?.querySelector('thead')?.getBoundingClientRect().height || 0
        setShowScrollTop(Boolean(root && fiftiethRow
            && fiftiethRow.getBoundingClientRect().bottom <= root.getBoundingClientRect().top + headerHeight))
    }, [])

    function toggleFullscreen() {
        scrollPosition.current = scrollRoot.current?.scrollTop || 0
        setFullscreen(value => !value)
    }

    useLayoutEffect(() => {
        if (fullscreen) dialog.current?.showModal()
        else if (dialog.current?.open) {
            dialog.current.close()
            fullscreenButton.current?.focus()
        }
        if (scrollRoot.current) scrollRoot.current.scrollTop = scrollPosition.current
        updateScrollTopButton()
    }, [fullscreen, updateScrollTopButton])
    useEffect(() => {
        if (!fullscreen) return
        const overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = overflow }
    }, [fullscreen])
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && fullscreen && !event.isComposing) {
                event.preventDefault()
                scrollPosition.current = scrollRoot.current?.scrollTop || 0
                setFullscreen(false)
                return
            }
            if (!isManagementSearchShortcut(event)) return
            event.preventDefault()
            setSearchOpen(true)
            requestAnimationFrame(() => searchInput.current?.focus())
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [fullscreen])

    const { failedCount, reviewEvents } = useMemo(() => summarizeAuditFailures(sortedEvents), [sortedEvents])
    return {
        audit, setAudit, activeFilters, sortedEvents, queryResult, loading, error, searchError,
        searchOpen, setSearchOpen, filtersOpen, setFiltersOpen, analyticsOpen, setAnalyticsOpen,
        alertsOpen, setAlertsOpen, hqlSyntaxOpen, setHqlSyntaxOpen, openEvent, setOpenEvent,
        mode, setMode, search, setSearch, fullscreen, setFullscreen, showScrollTop, setShowScrollTop,
        dialog, fullscreenButton, searchInput, scrollRoot, sentinel,
        failedCount, reviewEvents, lastEvent: sortedEvents[0], loadEvents, loadMore,
        toggleFullscreen, updateScrollTopButton,
    }
}
