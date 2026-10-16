import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { LocalDecision, QueueFilter, WorkbenchCase } from './types'
import { filterCases, queueSummary, workbenchSummary } from './modules/presentation'

export function useWorkbenchQueue(initialCases: WorkbenchCase[], initialSelectedId?: string) {
    const [selectedId, setSelectedId] = useState(() => initialCases.find(item => item.id === initialSelectedId)?.id ?? initialCases[0]?.id ?? '')
    const [filter, setFilter] = useState<QueueFilter>('all')
    const [query, setQuery] = useState('')
    const [notes, setNotes] = useState<Record<string, string>>({})
    const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({})
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('analyst')
    const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({})
    const cases = useMemo(() => filterCases(initialCases, filter, query), [initialCases, filter, query])
    const selected = initialCases.find(item => item.id === selectedId) ?? cases[0] ?? initialCases[0]
    const queues = queueSummary(initialCases)
    const workbenchStats = useMemo(() => workbenchSummary(initialCases), [initialCases])

    const focusQueueIndex = useCallback((nextIndex: number) => {
        const next = cases[nextIndex]
        if (!next) return
        setSelectedId(next.id)
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-queue-index="${nextIndex}"]`)?.focus())
    }, [cases])
    const focusDetailAction = useCallback(() => {
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-detail-action]')?.focus())
    }, [])
    const handleQueueKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (!cases.length) return
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            focusQueueIndex(Math.min(index + 1, cases.length - 1))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            focusQueueIndex(Math.max(index - 1, 0))
        } else if (event.key === 'Home') {
            event.preventDefault()
            focusQueueIndex(0)
        } else if (event.key === 'End') {
            event.preventDefault()
            focusQueueIndex(cases.length - 1)
        } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
            event.preventDefault()
            const item = cases[index]
            if (item) setSelectedId(item.id)
            focusDetailAction()
        }
    }, [cases, focusDetailAction, focusQueueIndex])

    return {
        selectedId, setSelectedId, filter, setFilter, query, setQuery, notes, setNotes,
        ownerDrafts, setOwnerDrafts, inviteEmail, setInviteEmail, inviteRole, setInviteRole,
        localDecisions, setLocalDecisions, cases, selected, queues, workbenchStats, handleQueueKeyDown,
    }
}
