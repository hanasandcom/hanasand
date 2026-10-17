'use client'

import { Fragment, useContext, useEffect, useRef, useState } from 'react'
import { formatDatabaseBytes as bytes } from '@/utils/db/formatDatabaseBytes'
import DatabaseSortButton from './DatabaseSortButton'
import DatabaseContents from './DatabaseContents'
import { compare, nextSort } from './databaseInventoryHelpers'
import type { DatabaseSort, Instance, Sort } from './databaseInventoryTypes'
import { DatabaseFullscreenContext } from './databaseStoragePanel'

export default function DatabaseInventory({ instances, stale }: { instances: Instance[], stale: boolean }) {
    const fullscreen = useContext(DatabaseFullscreenContext)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [sort, setSort] = useState<Sort<DatabaseSort>>({ key: 'health', descending: false })
    const viewport = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState<number>()
    const rows = instances.flatMap(instance => instance.databases.map(database => ({ instance, database })))
    const health = (instance: Instance) => stale ? 0 : instance.status === 'healthy' ? 2 : instance.status === 'unhealthy' ? 1 : 0
    const value = ({ instance, database }: typeof rows[number]) => ({ name: database.name, instance: instance.id, health: health(instance), count: database.tableCount, connections: database.connections, size: database.sizeBytes })[sort.key]
    rows.sort((a, b) => compare(value(a), value(b), sort.descending) || compare(a.database.sizeBytes, b.database.sizeBytes, true) || a.database.name.localeCompare(b.database.name) || a.instance.id.localeCompare(b.instance.id))
    useEffect(() => {
        if (rows.length <= 6 || !viewport.current) return
        const headers = viewport.current.querySelector('thead')
        const entries = Array.from(viewport.current.querySelectorAll<HTMLElement>('[data-database-row]')).slice(0, 6)
        const measure = () => setHeight(entries.reduce((total, row) => total + row.getBoundingClientRect().height, headers?.getBoundingClientRect().height || 0) + 1)
        const observer = new ResizeObserver(measure)
        if (headers) observer.observe(headers)
        entries.forEach(row => observer.observe(row))
        measure()
        return () => observer.disconnect()
    }, [instances, rows.length, sort])
    const columns: [DatabaseSort, string][] = [['name', 'Database'], ['instance', 'Instance'], ['health', 'Health'], ['count', 'Tables / keys'], ['connections', 'Connections'], ['size', 'Size']]
    const maxHeight = fullscreen ? 'calc(100dvh - 6rem)' : rows.length > 6 ? height === undefined ? undefined : height * (expanded ? 2 : 1) : undefined
    return <div ref={viewport} className='overflow-auto' style={{ maxHeight }} tabIndex={0} aria-label='Databases'><table className='w-full text-left text-sm'>
        <thead className='sticky top-0 z-10 bg-ui-raised text-xs text-ui-muted'><tr>{columns.map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.descending ? 'descending' : 'ascending' : 'none'} className='px-5 py-2 font-medium'><DatabaseSortButton label={label} active={sort.key === key} descending={sort.descending} onClick={() => setSort(current => nextSort(current, key))} /></th>)}</tr></thead>
        <tbody>
            {rows.map(({ instance, database }) => {
                const key = `${instance.id}/${database.name}`, open = expanded === key
                const toggle = () => setExpanded(open ? null : key)
                return <Fragment key={key}>
                    <tr data-database-row onClick={toggle} className={`cursor-pointer border-t transition hover:bg-ui-primary/10 ${open ? 'border-ui-primary bg-ui-primary/10' : 'border-ui-border'}`}>
                        <td className='px-5 py-3 font-medium'><button type='button' aria-expanded={open} onClick={event => { event.stopPropagation(); toggle() }} className='cursor-pointer text-left focus-visible:outline-ui-primary'>{database.name}</button>{database.replica && <span className='ml-2 text-xs text-ui-muted'>Replica</span>}</td>
                        <td className='px-5 py-3 text-xs text-ui-muted'>{instance.id}<span className='block'>{instance.engine}</span></td>
                        <td className={`px-5 py-3 ${!stale && instance.status === 'healthy' ? 'text-ui-success' : 'text-ui-warning'}`}>{stale ? 'Unknown' : instance.status === 'healthy' ? 'Healthy' : instance.status === 'unhealthy' ? 'Unhealthy' : 'Unavailable'}</td>
                        <td className='px-5 py-3 tabular-nums'>{database.tableCount ?? '—'}</td>
                        <td className='px-5 py-3 tabular-nums'>{database.connections ?? '—'}</td>
                        <td className='whitespace-nowrap px-5 py-3 tabular-nums'>{bytes(database.sizeBytes)}{database.memory && <span className='ml-1 text-xs text-ui-muted'>RAM</span>}</td>
                    </tr>
                    {open && <tr className='border-b-2 border-ui-primary bg-ui-primary/5'><td colSpan={6} className='p-4'><DatabaseContents instance={instance} database={database} /></td></tr>}
                </Fragment>
            })}
        </tbody>
    </table></div>
}
