'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDatabaseBytes as bytes } from '@/utils/db/formatDatabaseBytes'
import DatabaseSortButton from './DatabaseSortButton'
import DatabaseRowPreview from './DatabaseRowPreview'
import { compare, fetchPage, nextSort } from './databaseInventoryHelpers'
import type { Database, Instance, Item, ItemSort, Sort } from './databaseInventoryTypes'

export default function DatabaseContents({ instance, database }: { instance: Instance, database: Database }) {
    const [items, setItems] = useState<Item[]>(database.tables || [])
    const [cursor, setCursor] = useState<string | null>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<Sort<ItemSort>>({ key: 'size', descending: true })
    const searchInput = useRef<HTMLInputElement>(null)
    const list = useRef<HTMLDivElement>(null)
    const [listHeight, setListHeight] = useState<number>()
    const manyTables = items.length > 6
    useEffect(() => {
        if (!manyTables) return
        const focusSearch = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            if (event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'x'
                && !target?.closest('input, textarea, select, [contenteditable="true"]')) {
                event.preventDefault(); searchInput.current?.focus()
            }
        }
        window.addEventListener('keydown', focusSearch)
        return () => window.removeEventListener('keydown', focusSearch)
    }, [manyTables])
    useEffect(() => {
        if (!manyTables || !list.current) return
        const buttons = Array.from(list.current.querySelectorAll<HTMLElement>('[data-table-selector]')).slice(0, 6)
        if (buttons.length < 6) return
        const measure = () => setListHeight(buttons.reduce((height, button, index) => height + button.getBoundingClientRect().height + (index ? 12 : 0), 0))
        const observer = new ResizeObserver(measure)
        buttons.forEach(button => observer.observe(button))
        measure()
        return () => observer.disconnect()
    }, [manyTables, items, search, sort])
    const itemValue = (item: Item) => ({ name: `${item.schema}.${item.name}`, write: item.lastWriteObservedAt ? Date.parse(item.lastWriteObservedAt) : null, size: item.sizeBytes })[sort.key]
    const visibleItems = items.filter(item => `${item.schema}.${item.name}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => compare(itemValue(a), itemValue(b), sort.descending) || `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`))
    const [error, setError] = useState('')
    const [pending, setPending] = useState(!database.tables)
    const params = () => new URLSearchParams({ instance: instance.id, database: database.name, mode: 'contents' })
    useEffect(() => {
        if (database.tables) return
        const controller = new AbortController()
        fetchPage(params(), controller.signal).then(page => { setItems(page.items || []); setCursor(page.nextCursor) }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) }).finally(() => setPending(false))
        return () => controller.abort()
    // The component is remounted when the database selection changes.
    }, [])
    async function more() {
        setPending(true); setError('')
        try {
            const next = params(); if (cursor) next.set('cursor', cursor)
            const page = await fetchPage(next)
            setItems(previous => [...previous, ...(page.items || []).filter(item => !previous.some(old => old.name === item.name && old.schema === item.schema))]); setCursor(page.nextCursor)
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Preview unavailable.') } finally { setPending(false) }
    }
    return <div className='min-w-0 space-y-3 [contain:inline-size]'>
        {manyTables && <input ref={searchInput} type='search' value={search} onChange={event => setSearch(event.target.value)} placeholder='Search tables…' aria-label='Search tables' aria-keyshortcuts='Meta+X' className='w-full max-w-xs rounded border border-ui-border bg-ui-canvas px-3 py-1.5 text-sm' />}
        <div className='flex flex-wrap gap-4 px-3 sm:grid sm:grid-cols-[minmax(0,1fr)_12rem_7rem] sm:gap-2' aria-label='Sort database contents'>
            {([['name', 'Name'], ['write', 'Last write'], ['size', 'Size']] as const).map(([key, label]) => <DatabaseSortButton key={key} label={label} active={sort.key === key} descending={sort.descending} onClick={() => setSort(current => nextSort(current, key))} />)}
        </div>
        {cursor && <p className='text-xs text-ui-muted'>Sorting loaded keys</p>}
        <div ref={list} className='min-w-0 space-y-3 overflow-y-auto' style={{ maxHeight: manyTables ? listHeight : undefined }}>
            {visibleItems.map(item => {
                const key = `${item.schema}.${item.name}`, open = selected === key
                return <div key={key} className={`overflow-hidden rounded-md border ${open ? 'border-ui-primary bg-ui-canvas' : 'border-ui-border bg-ui-panel'}`}>
                    <button data-table-selector type='button' aria-expanded={open} onClick={() => setSelected(open ? null : key)} className={`grid w-full cursor-pointer grid-cols-1 gap-2 p-3 text-left transition hover:bg-ui-primary/10 sm:grid-cols-[minmax(0,1fr)_12rem_7rem] ${open ? 'bg-ui-primary/10' : ''}`}>
                        <span className='min-w-0 wrap-break-word font-medium'>{item.schema ? `${item.schema}.` : ''}{item.name}{item.type && <span className='ml-2 text-xs text-ui-muted'>{item.type}</span>}</span>
                        <span className='text-xs text-ui-muted' title={item.lastWriteObservedAt ? 'Last observed write' : 'No writes observed'}>{item.lastWriteObservedAt ? `Last write: ${new Date(item.lastWriteObservedAt).toLocaleString()}` : '—'}</span>
                        <span className='text-xs tabular-nums text-ui-muted'>{bytes(item.sizeBytes)}</span>
                    </button>
                    {open && <div className='border-t border-ui-primary/30 p-3'><DatabaseRowPreview instance={instance.id} database={database.name} item={item} /></div>}
                </div>
            })}
        </div>
        {search && !visibleItems.length && <p className='text-sm text-ui-muted'>No matching tables.</p>}
        {!pending && !error && !items.length && <p className='text-sm text-ui-muted'>Empty database.</p>}
        {pending && <p role='status' className='text-sm text-ui-muted'>Loading…</p>}
        {error && <p role='alert' className='text-sm text-ui-warning'>{error} <button type='button' onClick={more} className='underline'>Retry</button></p>}
        {cursor && !pending && !error && <button type='button' onClick={more} className='rounded border border-ui-border px-3 py-2 text-sm'>More keys</button>}
    </div>
}
