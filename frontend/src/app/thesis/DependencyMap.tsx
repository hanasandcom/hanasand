import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CodeItem } from '@/utils/codeReviewTypes'
import { icons, kinds, names } from './codeReviewShared'
import { DependencyMapSearch } from './DependencyMapSearch'
import { DependencyMapSvg } from './DependencyMapSvg'
import { DependencyMapToolbar } from './DependencyMapToolbar'
import { useDependencyMapGestures } from './useDependencyMapGestures'

type Props = {
    items: CodeItem[]
    selected?: CodeItem
    onSelect: (id: string) => void
}

export function DependencyMap({ items, selected, onSelect }: Props) {
    const [zoom, setZoom] = useState(1)
    const [limit, setLimit] = useState(12)
    const [overview, setOverview] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [query, setQuery] = useState('')
    const viewport = useRef<HTMLDivElement>(null)
    const searchInput = useRef<HTMLInputElement>(null)
    const zoomRef = useRef(1)
    const dragged = useRef(false)
    const searchTrigger = useRef<HTMLElement | null>(null)

    function openSearch() {
        if (!searchInput.current) {
            searchTrigger.current = document.activeElement as HTMLElement | null
        }
        setSearchOpen(true)
        requestAnimationFrame(() => searchInput.current?.focus())
    }

    function closeSearch() {
        setSearchOpen(false)
        searchTrigger.current?.focus({ preventScroll: true })
    }

    const changeZoom = useCallback((value: number, clientX?: number, clientY?: number) => {
        const element = viewport.current
        if (!element) return
        const bounds = element.getBoundingClientRect()
        const x = clientX === undefined ? element.clientWidth / 2 : clientX - bounds.left
        const y = clientY === undefined ? element.clientHeight / 2 : clientY - bounds.top
        const next = Math.max(Number.EPSILON, Math.min(16, value))
        const ratio = next / zoomRef.current
        const left = (element.scrollLeft + x) * ratio - x
        const top = (element.scrollTop + y) * ratio - y
        zoomRef.current = next
        setZoom(next)
        requestAnimationFrame(() => element.scrollTo(Math.max(0, left), Math.max(0, top)))
    }, [])

    useDependencyMapGestures(viewport, zoomRef, dragged, changeZoom)
    useEffect(() => {
        function shortcut(event: KeyboardEvent) {
            if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'j') return
            event.preventDefault()
            event.stopImmediatePropagation()
            openSearch()
        }
        window.addEventListener('keydown', shortcut)
        return () => window.removeEventListener('keydown', shortcut)
    }, [])
    useEffect(() => {
        if (searchOpen) searchInput.current?.focus()
    }, [searchOpen])
    useEffect(() => {
        if (!expanded) return
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = previous }
    }, [expanded])

    function focusItem(id: string) {
        onSelect(id)
        setOverview(false)
        setLimit(12)
        changeZoom(1)
        requestAnimationFrame(() => viewport.current?.scrollTo(0, 0))
    }

    const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
    const dependencies = (selected?.dependencies || [])
        .map(id => byId.get(id))
        .filter((item): item is CodeItem => Boolean(item))
    const dependents = selected ? items.filter(item => item.dependencies.includes(selected.id)) : []
    const summary = overview || !selected
    const height = summary
        ? 300
        : Math.max(
            220,
            Math.max(Math.min(dependencies.length, limit), Math.min(dependents.length, limit)) * 64 + 100,
        )
    const nodes = summary ? [] : [
        { item: selected, x: 350, y: 70 },
        ...dependents.slice(0, limit).map((item, index) => ({ item, x: 10, y: 70 + index * 64 })),
        ...dependencies.slice(0, limit).map((item, index) => ({ item, x: 690, y: 70 + index * 64 })),
    ]
    const normalizedQuery = query.trim().toLowerCase()
    const matches = normalizedQuery
        ? items.filter(item => (item.title + ' ' + item.file).toLowerCase().includes(normalizedQuery))
        : []

    return (
        <section
            aria-label='Dependency map'
            className='code-map'
            data-expanded={expanded}
            onKeyDownCapture={event => {
                if (event.key !== 'Escape' || !searchOpen) return
                event.preventDefault()
                event.stopPropagation()
                event.nativeEvent.stopImmediatePropagation()
                closeSearch()
            }}
        >
            <DependencyMapToolbar
                zoom={zoom}
                overview={overview}
                expanded={expanded}
                selected={selected}
                onZoomOut={() => changeZoom(zoomRef.current * 0.85)}
                onZoomIn={() => changeZoom(zoomRef.current / 0.85)}
                onToggleOverview={() => setOverview(value => !value)}
                onFocusSelected={() => selected && focusItem(selected.id)}
                onOpenSearch={openSearch}
                onToggleExpanded={() => setExpanded(value => !value)}
            />
            {searchOpen && (
                <DependencyMapSearch
                    query={query}
                    matches={matches}
                    inputRef={searchInput}
                    onQueryChange={setQuery}
                    onSelect={focusItem}
                    onClose={closeSearch}
                />
            )}
            <div
                className='code-map-scroll'
                ref={viewport}
                tabIndex={0}
                aria-label='Scrollable dependency map'
                onPointerDownCapture={event => {
                    if (event.pointerType !== 'touch') dragged.current = false
                }}
                onClickCapture={event => {
                    if (!dragged.current) return
                    event.preventDefault()
                    event.stopPropagation()
                    dragged.current = false
                }}
            >
                {summary
                    ? <DependencyMapOverview items={items} selected={selected} onSelect={focusItem} />
                    : <DependencyMapSvg nodes={nodes} selected={selected!} zoom={zoom} height={height} onSelect={onSelect} />}
            </div>
            {!summary && Math.max(dependencies.length, dependents.length) > limit && (
                <button className='code-more' onClick={() => setLimit(value => value + 24)}>
                    Show more connections ({Math.max(0, dependencies.length - limit) + Math.max(0, dependents.length - limit)} hidden)
                </button>
            )}
        </section>
    )
}

function DependencyMapOverview({ items, selected, onSelect }: {
    items: CodeItem[]
    selected?: CodeItem
    onSelect: (id: string) => void
}) {
    return (
        <div className='code-map-summary'>
            {kinds.map(kind => {
                const Icon = icons[kind]
                const first = items.find(item => item.kind === kind)
                return (
                    <button key={kind} onClick={() => first && onSelect(first.id)}>
                        <Icon size={22} />
                        <span>{names[kind]}</span>
                        <b>{items.filter(item => item.kind === kind).length}</b>
                    </button>
                )
            })}
            {selected && (
                <p>
                    {selected.title}: <b>{selected.dependencyCount}</b> dependencies. Expand connections or focus to explore.
                </p>
            )}
        </div>
    )
}
