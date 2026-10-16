'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw } from 'lucide-react'
import { reviewPriority, reviewStatus, type CodeInventory } from '@/utils/codeReviewTypes'
import { website } from './codeReviewShared'
import { CodeInventoryPanel } from './CodeInventoryPanel'
import { DependencyMap } from './DependencyMap'
import { SourceDetail } from './SourceDetail'
import './codeReview.css'

export default function CodeReview({ canReview, toolbar }: { canReview: boolean, toolbar: HTMLElement | null }) {
    const [data, setData] = useState<CodeInventory | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [clock, setClock] = useState(0)
    const [order, setOrder] = useState('priority')
    const version = useRef('')
    const [selected, setSelected] = useState('')
    const [query, setQuery] = useState('')
    const [scope, setScope] = useState('website')
    const [status, setStatus] = useState('all')
    const [limit, setLimit] = useState(100)

    const load = useCallback(async (automatic = false) => {
        if (!automatic) setLoading(true)
        setError('')
        try {
            const since = automatic && version.current
                ? `?since=${encodeURIComponent(version.current)}`
                : ''
            const response = await fetch(`/api/thesis/code${since}`, { cache: 'no-store' })
            if (response.status === 204) {
                setData(current => current?.sync && (
                    current.sync.phase !== 'ready' || current.sync.error || current.sync.warning
                ) ? { ...current, sync: { phase: 'ready' } } : current)
                return
            }
            if (response.status === 403) {
                setData(null)
                version.current = ''
                setError('Hanasand organization membership is required to view this thesis.')
                return
            }
            const result = await response.json()
            if (!response.ok) throw new Error(result.error)
            version.current = result.hash + ':' + (result.revision || '')
            setData(result)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'The inventory could not be loaded.')
        } finally {
            setLoading(false)
        }
    }, [])
    useEffect(() => {
        let stopped = false
        let timer: ReturnType<typeof setTimeout>
        async function poll() {
            await load(true)
            if (!stopped) timer = setTimeout(poll, 3000)
        }
        load().then(() => {
            if (!stopped) timer = setTimeout(poll, 3000)
        })
        const clock = setInterval(() => setClock(value => value + 1), 60000)
        return () => {
            stopped = true
            clearTimeout(timer)
            clearInterval(clock)
        }
    }, [load])
    const byId = useMemo(() => new Map(data?.nodes.map(item => [item.id, item]) || []), [data])
    const scoped = useMemo(() => data?.nodes.filter(item => scope === 'repository' || website(item)) || [], [data, scope])
    const filtered = useMemo(() => scoped
        .filter(item => (
            (item.title + ' ' + item.file).toLowerCase().includes(query.toLowerCase())
            && (status === 'all' || reviewStatus(item) === status)
        ))
        .sort((a, b) => (
            (order === 'priority' ? reviewPriority(a) - reviewPriority(b) : 0)
            || a.title.localeCompare(b.title, 'en')
        )), [scoped, query, status, order, clock])
    const item = byId.get(selected) || scoped.find(node => node.kind === 'frontend') || scoped[0]
    const select = (id: string) => {
        setSelected(id)
        const selectedItem = byId.get(id)
        if (selectedItem && !website(selectedItem)) setScope('repository')
    }

    return (
        <section className='code-workspace' aria-label='Code review workspace'>
            {toolbar && createPortal(
                <button
                    className='inline-flex min-h-11 items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm hover:bg-ui-raised disabled:opacity-40'
                    disabled={loading}
                    onClick={() => load()}
                >
                    <RotateCcw size={15} /> Refresh
                </button>,
                toolbar,
            )}
            {error && <p role='alert'>{error}</p>}
            {data?.sync?.phase === 'indexing' && (
                <p role='status'>Updating from the latest Git commit…</p>
            )}
            {(data?.sync?.error || data?.sync?.warning) && (
                <p role='alert'>{data.sync.error || data.sync.warning}</p>
            )}
            {loading && <p role='status'>Loading inventory…</p>}
            {data && <>
                <CodeInventoryPanel
                    scoped={scoped}
                    filtered={filtered}
                    selectedId={item?.id}
                    query={query}
                    scope={scope}
                    order={order}
                    status={status}
                    limit={limit}
                    onQueryChange={value => {
                        setQuery(value)
                        setLimit(100)
                    }}
                    onScopeChange={value => {
                        setScope(value)
                        setLimit(100)
                    }}
                    onOrderChange={setOrder}
                    onStatusChange={value => {
                        setStatus(value)
                        setLimit(100)
                    }}
                    onSelect={select}
                    onShowMore={() => setLimit(value => value + 100)}
                >
                    <DependencyMap items={data.nodes} selected={item} onSelect={select} />
                    {item && (
                        <SourceDetail
                            canReview={canReview}
                            key={item.id + ':' + item.reviewHash}
                            item={item}
                            byId={byId}
                            onSelect={select}
                            onReview={event => setData(current => current && ({
                                ...current,
                                nodes: current.nodes.map(node => node.id === event.item_id
                                    ? { ...node, review: event }
                                    : node),
                            }))}
                        />
                    )}
                </CodeInventoryPanel>
                <details className='code-caption'>
                    <summary>Inventory details and coverage</summary>
                    <p>
                        Repository commit: {data.release}. Updates from Git appear automatically; a site redeployment is not needed.
                        Runtime data, credentials, binary files and build output are excluded. Route and query entries describe
                        source declarations, not recorded production requests. Computed requests and non-JavaScript dependencies
                        require manual inspection; see “References to inspect” on each source file.
                    </p>
                    <code>Inventory SHA-256: {data.hash}</code>
                </details>
            </>}
        </section>
    )
}
