import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { getCookie } from 'hanasand/cookies'
import type { FeedbackFilter, StarFilter, StatusFilter, TicketFilters } from './supportChatTypes'

export function useSupportChatFilters({ isSupport, initialSupport, loadTickets, setError, filterControlsRef }: {
    isSupport: boolean
    initialSupport: boolean
    loadTickets: () => Promise<unknown>
    setError: (message: string) => void
    filterControlsRef: MutableRefObject<TicketFilters>
}) {
    const [userId, setUserId] = useState('')
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [filterText, setFilterText] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
    const [starFilter, setStarFilter] = useState<StarFilter>('all')
    const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [filterSettingsReady, setFilterSettingsReady] = useState(false)
    filterControlsRef.current = { search: filterText, status: statusFilter, stars: starFilter, feedback: feedbackFilter, from: dateFrom, to: dateTo }
    const filterControlsInitialized = useRef(false)

    useEffect(() => {
        const currentUserId = getCookie('impersonating_id') || getCookie('id') || ''
        setUserId(currentUserId)
        try {
            const saved = localStorage.getItem(`hanasand:support-chat-filters:${currentUserId || 'default'}`)
            if (saved) {
                const filters = JSON.parse(saved) as Record<string, unknown>
                if (typeof filters.search === 'string') setFilterText(filters.search.slice(0, 160))
                if (filters.status === 'open' || filters.status === 'resolved' || filters.status === 'all') setStatusFilter(filters.status)
                if (filters.stars === 'all' || filters.stars === 'rated' || filters.stars === 'unrated' || /^[1-5]$/.test(String(filters.stars))) setStarFilter(filters.stars as StarFilter)
                if (filters.feedback === 'all' || filters.feedback === 'comment' || filters.feedback === 'none') setFeedbackFilter(filters.feedback)
                if (typeof filters.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) setDateFrom(filters.from)
                if (typeof filters.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) setDateTo(filters.to)
            }
        } catch { /* Ignore unavailable or invalid local filter settings. */ }
        setFilterSettingsReady(true)
    }, [])

    useEffect(() => {
        if (!filterSettingsReady) return
        try {
            localStorage.setItem(`hanasand:support-chat-filters:${userId || 'default'}`, JSON.stringify({
                search: filterText, status: statusFilter, stars: starFilter, feedback: feedbackFilter, from: dateFrom, to: dateTo,
            }))
        } catch { /* Filtering still works when browser storage is unavailable. */ }
    }, [dateFrom, dateTo, feedbackFilter, filterSettingsReady, filterText, starFilter, statusFilter, userId])

    useEffect(() => {
        if (!isSupport || !filterSettingsReady) return
        if (!filterControlsInitialized.current) {
            filterControlsInitialized.current = true
            if (!initialSupport) return
        }
        const timer = window.setTimeout(() => {
            void loadTickets().catch(error => setError(error instanceof Error ? error.message : 'Could not filter support chats.'))
        }, 250)
        return () => window.clearTimeout(timer)
    }, [dateFrom, dateTo, feedbackFilter, filterSettingsReady, filterText, initialSupport, isSupport, loadTickets, setError, starFilter, statusFilter])

    return {
        userId,
        filterControlsRef,
        filtersOpen,
        setFiltersOpen,
        filterText,
        setFilterText,
        statusFilter,
        setStatusFilter,
        starFilter,
        setStarFilter,
        feedbackFilter,
        setFeedbackFilter,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
    }
}
