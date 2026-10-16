'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { generatedSearchRoutes } from '@/utils/routes/generatedSearchRoutes'
import ResultGroup from './siteSearch/ResultGroup'
import { directThreatItem, filterItems, manualSearchItem, routeRelevance } from './siteSearch/searchData'
import { useSearchData } from './siteSearch/useSearchData'
import type { SearchGroup } from './siteSearch/types'

export { actorItems, caseItem, directThreatItem } from './siteSearch/searchData'

export default function SiteSearch({ token }: { token: boolean }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const cleanQuery = query.trim().toLowerCase()
    const { cases, actors, savedSearches, watchTerms, loading, casesLoading } = useSearchData(open, token, cleanQuery)
    const routeResults = useMemo(
        () => filterItems([...generatedSearchRoutes], cleanQuery)
            .sort((a, b) => routeRelevance(b, cleanQuery) - routeRelevance(a, cleanQuery)),
        [cleanQuery],
    )
    const directThreatResult = useMemo(() => directThreatItem(cleanQuery, actors), [actors, cleanQuery])
    const caseResults = useMemo(() => filterItems(cases, cleanQuery).slice(0, 6), [cases, cleanQuery])
    const savedResults = useMemo(() => filterItems(savedSearches, cleanQuery).slice(0, 4), [savedSearches, cleanQuery])
    const watchResults = useMemo(() => filterItems(watchTerms, cleanQuery).slice(0, 4), [watchTerms, cleanQuery])
    const fallbackSearch = useMemo(
        () => cleanQuery && !directThreatResult ? manualSearchItem(cleanQuery) : null,
        [cleanQuery, directThreatResult],
    )
    const groups = useMemo<SearchGroup[]>(() => [
        { title: 'ROUTES', items: routeResults, icon: 'route' },
        { title: 'THREAT INTELLIGENCE', items: directThreatResult ? [directThreatResult] : [], icon: 'actor' },
        { title: 'CASES', items: token ? caseResults : [], icon: 'case' },
        { title: 'SAVED SEARCHES', items: savedResults, icon: 'route' },
        { title: 'WATCHLISTS', items: watchResults, icon: 'actor' },
        { title: 'RECENT EVIDENCE', items: actors.filter(item => item.href !== directThreatResult?.href).slice(0, 6), icon: 'route' },
        { title: 'SEARCH', items: fallbackSearch ? [fallbackSearch] : [], icon: 'route' },
    ], [actors, caseResults, directThreatResult, fallbackSearch, routeResults, savedResults, token, watchResults])
    const flatResults = useMemo(() => groups.flatMap(group => group.items), [groups])

    useEffect(() => setSelectedIndex(0), [cleanQuery])

    useEffect(() => {
        if (!open || !flatResults.length) return
        document.getElementById(`site-search-result-${flatResults[selectedIndex]?.id}`)?.scrollIntoView({ block: 'nearest' })
    }, [flatResults, open, selectedIndex])

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setOpen(true)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    useEffect(() => {
        if (!open) return
        requestAnimationFrame(() => inputRef.current?.focus())
    }, [open])

    function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            event.nativeEvent.stopImmediatePropagation()
            setOpen(false)
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (flatResults.length) {
                setSelectedIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + flatResults.length) % flatResults.length)
            }
        }
        if (event.key === 'Enter' && flatResults.length) {
            event.preventDefault()
            const selected = flatResults[selectedIndex]
            if (selected) {
                router.push(selected.href)
                setOpen(false)
            }
        }
    }

    return (
        <>
            <button
                type='button'
                onClick={() => setOpen(true)}
                className='hidden h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-canvas hover:text-ui-text md:inline-flex'
                aria-label='Open search'
                title='Search'
            >
                <Search className='h-4 w-4' />
                <span className='hidden lg:inline'>Search</span>
                <kbd className='rounded-md border border-ui-border bg-ui-panel px-1.5 py-0.5 text-[10px] font-semibold text-ui-muted'>Cmd K</kbd>
            </button>

            {open ? (
                <div
                    role='dialog'
                    aria-modal='true'
                    aria-label='Site search'
                    onKeyDownCapture={handleDialogKeyDown}
                    className='fixed inset-0 z-[1200] bg-ui-canvas/70 px-3 py-20 backdrop-blur'
                    onMouseDown={() => setOpen(false)}
                >
                    <div
                        className='mx-auto max-w-3xl overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-[0_28px_90px_var(--ui-shadow)]'
                        onMouseDown={event => event.stopPropagation()}
                    >
                        <div className='flex h-16 items-center gap-3 border-b border-ui-border px-4'>
                            <Search className='h-5 w-5 text-ui-muted' />
                            <input
                                ref={inputRef}
                                aria-label='Search routes and workspace'
                                aria-activedescendant={flatResults[selectedIndex] ? `site-search-result-${flatResults[selectedIndex].id}` : undefined}
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder='Search routes, cases, and threat actors'
                                className='h-full min-w-0 flex-1 bg-transparent text-lg text-ui-text outline-none placeholder:text-ui-muted'
                            />
                            {loading || casesLoading ? <Loader2 className='h-4 w-4 animate-spin text-ui-muted' /> : null}
                            <button
                                type='button'
                                onClick={() => setOpen(false)}
                                className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                                aria-label='Close search'
                            >
                                <X className='h-4 w-4' />
                            </button>
                        </div>
                        <div className='max-h-[60vh] overflow-auto p-3'>
                            <div role='listbox' aria-label='Search results'>
                                {groups.map(group => (
                                    <ResultGroup
                                        key={group.title}
                                        {...group}
                                        selectedIndex={selectedIndex}
                                        startIndex={flatResults.findIndex(item => item.id === group.items[0]?.id)}
                                        onSelect={() => setOpen(false)}
                                        onSelectIndex={setSelectedIndex}
                                    />
                                ))}
                            </div>
                            {!flatResults.length ? (
                                <div className='grid min-h-40 place-items-center text-sm font-medium text-ui-muted'>
                                    {cleanQuery ? 'No results' : 'Start typing to search everything'}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    )
}
