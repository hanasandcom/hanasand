'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Search, ShieldCheck, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { generatedSearchRoutes } from '@/utils/routes/generatedSearchRoutes'

type SearchItem = {
    id: string
    title: string
    detail: string
    href: string
}

export default function SiteSearch({ token }: { token: boolean }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [cases, setCases] = useState<SearchItem[]>([])
    const [casesLoading, setCasesLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const casesLoadedAt = useRef(0)
    const router = useRouter()
    const cleanQuery = query.trim().toLowerCase()
    const routeResults = useMemo(() => filterItems([...generatedSearchRoutes], cleanQuery).sort((a, b) => routeRelevance(b, cleanQuery) - routeRelevance(a, cleanQuery)), [cleanQuery])
    const directThreatResult = useMemo(() => cleanQuery.length >= 2 ? {
        id: `threat:${cleanQuery}`,
        title: `Threat intelligence: ${query.trim()}`,
        detail: 'Open the separate threat intelligence workspace',
        href: `https://ti.hanasand.com/ti/${encodeURIComponent(query.trim())}`,
    } : null, [cleanQuery, query])
    const caseResults = useMemo(() => filterItems(cases, cleanQuery).slice(0, 6), [cases, cleanQuery])
    const groups = useMemo(() => [
        { title: 'ROUTES', items: routeResults, icon: 'route' as const },
        { title: 'THREAT INTELLIGENCE', items: directThreatResult ? [directThreatResult] : [], icon: 'route' as const },
        { title: 'CASES', items: token ? caseResults : [], icon: 'case' as const },
    ], [caseResults, directThreatResult, routeResults, token])
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
        if (!open) return
        requestAnimationFrame(() => inputRef.current?.focus())
    }, [open])


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
                <div role='dialog' aria-modal='true' aria-label='Site search' onKeyDownCapture={event => {
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); setOpen(false) }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault()
                        if (flatResults.length) setSelectedIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + flatResults.length) % flatResults.length)
                    }
                    if (event.key === 'Enter' && flatResults.length) {
                        event.preventDefault()
                        const selected = flatResults[selectedIndex]
                        if (selected) {
                            if (selected.href.startsWith('https://')) window.location.assign(selected.href)
                            else router.push(selected.href)
                            setOpen(false)
                        }
                    }
                }} className='fixed inset-0 z-[1200] bg-ui-canvas/70 px-3 py-20 backdrop-blur' onMouseDown={() => setOpen(false)}>
                    <div className='mx-auto max-w-3xl overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-[0_28px_90px_var(--ui-shadow)]' onMouseDown={event => event.stopPropagation()}>
                        <div className='flex h-16 items-center gap-3 border-b border-ui-border px-4'>
                            <Search className='h-5 w-5 text-ui-muted' />
                            <input
                                ref={inputRef}
                                aria-label='Search routes and workspace'
                                aria-activedescendant={flatResults[selectedIndex] ? `site-search-result-${flatResults[selectedIndex].id}` : undefined}
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder='Search routes and cases'
                                className='h-full min-w-0 flex-1 bg-transparent text-lg text-ui-text outline-none placeholder:text-ui-muted'
                            />
                            {casesLoading ? <Loader2 className='h-4 w-4 animate-spin text-ui-muted' /> : null}
                            <button type='button' onClick={() => setOpen(false)} className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text' aria-label='Close search'>
                                <X className='h-4 w-4' />
                            </button>
                        </div>
                        <div className='max-h-[60vh] overflow-auto p-3'>
                            <div role='listbox' aria-label='Search results'>
                                {groups.map(group => <ResultGroup key={group.title} {...group} selectedIndex={selectedIndex} startIndex={flatResults.findIndex(item => item.id === group.items[0]?.id)} onSelect={() => setOpen(false)} onSelectIndex={setSelectedIndex} />)}
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

function ResultGroup({ title, items, icon, onSelect, onSelectIndex, selectedIndex, startIndex }: { title: string, items: SearchItem[], icon: 'route' | 'case', onSelect: () => void, onSelectIndex: (index: number) => void, selectedIndex: number, startIndex: number }) {
    if (!items.length) return null
    return (
        <section role='group' aria-label={title} className='mb-3 last:mb-0'>
            <p className='px-2 pb-1 text-[10px] font-semibold uppercase text-ui-muted'>{title}</p>
            <div className='grid gap-1'>
                {items.map((item, index) => {
                    const selected = startIndex + index === selectedIndex
                    return <Link key={item.id} id={`site-search-result-${item.id}`} role='option' aria-selected={selected} href={item.href} onClick={onSelect} onMouseEnter={() => onSelectIndex(startIndex + index)} className={`grid grid-cols-[2.25rem_1fr] gap-3 rounded-lg border px-2 py-2 transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10' : 'border-transparent hover:bg-ui-raised'}`}>
                        <span className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                            {icon === 'case' ? <ShieldCheck className='h-4 w-4' /> : <FileText className='h-4 w-4' />}
                        </span>
                        <span className='min-w-0'>
                            <span className='block truncate text-sm font-semibold text-ui-text'>{item.title}</span>
                            <span className='block truncate text-xs leading-5 text-ui-muted'>{item.detail || item.href}</span>
                        </span>
                    </Link>
                })}
            </div>
        </section>
    )
}

function filterItems(items: SearchItem[], query: string) {
    if (!query) return items
    return items.filter(item => `${item.title} ${item.detail} ${item.href}`.toLowerCase().includes(query))
}

function routeRelevance(item: SearchItem, query: string) {
    if (!query) return 0
    const title = item.title.toLowerCase()
    if (title === query) return 3
    if (title.startsWith(query)) return 2
    return 1
}

async function loadCases(signal: AbortSignal): Promise<SearchItem[]> {
    const response = await fetch('/api/cases', { cache: 'no-store', signal })
    if (!response.ok) throw new Error('Cases are temporarily unavailable.')
    const payload = await response.json()
    return arrayFrom(payload, ['cases', 'items', 'rows'])
        .map(caseItem)
        .filter((item): item is SearchItem => Boolean(item))
}

export function caseItem(value: unknown): SearchItem | null {
    if (!value || typeof value !== 'object') return null
    const row = value as Record<string, unknown>
    const id = stringValue(row.id) || stringValue(row.caseId)
    if (!id) return null
    const title = stringValue(row.title) || stringValue(row.company) || stringValue(row.organizationName) || id
    const detail = [stringValue(row.status), stringValue(row.organizationName), stringValue(row.summary)].filter(Boolean).join(' · ')
    const href = stringValue(row.casePath) || `/cases/${encodeURIComponent(id)}`
    return { id: `case:${id}`, title, detail, href }
}

function arrayFrom(payload: unknown, keys: string[]) {
    if (Array.isArray(payload)) return payload
    if (!payload || typeof payload !== 'object') return []
    const record = payload as Record<string, unknown>
    for (const key of keys) {
        if (Array.isArray(record[key])) return record[key] as unknown[]
    }
    return []
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
