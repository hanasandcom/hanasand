import { useCallback, useEffect, useMemo, useState } from 'react'
import { reviewStatus, type CodeItem, type ReviewEvent } from '@/utils/codeReviewTypes'
import { ItemIcon, StatusIcon, related, statusNames } from './codeReviewShared'
import { ReviewHistory } from './ReviewHistory'

type Props = {
    canReview: boolean
    item: CodeItem
    onReview: (event: ReviewEvent) => void
    onSelect: (id: string) => void
    byId: Map<string, CodeItem>
}

export function SourceDetail({ item, onReview, onSelect, byId, canReview }: Props) {
    const [detail, setDetail] = useState<{ item: CodeItem, history: ReviewEvent[] } | null>(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [reviewOpen, setReviewOpen] = useState(false)
    const [more, setMore] = useState(false)
    const allDependencies = useMemo(() => related(item, byId), [item, byId])
    const sourceDependencies = allDependencies.filter(node => node.kind === 'source')

    const load = useCallback(async (signal?: AbortSignal) => {
        setError('')
        try {
            const params = new URLSearchParams({ id: item.id })
            const response = await fetch(`/api/thesis/code?${params}`, {
                cache: 'no-store',
                signal,
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error)
            setDetail(result)
            setMore(result.history.length === 50)
        } catch (cause) {
            if (!signal?.aborted) {
                setError(cause instanceof Error ? cause.message : 'Source could not be loaded.')
            }
        }
    }, [item.id])

    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
        return () => controller.abort()
    }, [load])

    async function approve(approved: boolean) {
        if (!detail || busy) return
        setBusy(true)
        setError('')
        try {
            const response = await fetch('/api/thesis/code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: item.id,
                    sha256: detail.item.sha256,
                    reviewHash: detail.item.reviewHash,
                    approved,
                    eventId: crypto.randomUUID(),
                }),
            })
            const event = await response.json()
            if (!response.ok) throw new Error(event.error)
            onReview(event)
            await load()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Review could not be saved.')
        } finally {
            setBusy(false)
        }
    }

    async function loadOlderReviews() {
        if (!detail) return
        setBusy(true)
        try {
            const before = detail.history.at(-1)!.event_id
            const params = new URLSearchParams({ id: item.id, before })
            const response = await fetch(`/api/thesis/code?${params}`)
            const result = await response.json()
            if (!response.ok) throw new Error(result.error)
            setDetail(current => current && ({
                ...current,
                history: [...current.history, ...result.history],
            }))
            setMore(result.history.length === 50)
        } catch {
            setError('Older reviews could not be loaded.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <article className='code-detail' aria-label='Selected code item'>
            <div className='code-detail-heading'>
                <ItemIcon item={item} />
                <h3>{item.title}</h3>
                <button
                    aria-label={`Review status: ${statusNames[reviewStatus(item)]}`}
                    aria-expanded={reviewOpen}
                    onClick={() => setReviewOpen(!reviewOpen)}
                >
                    <StatusIcon item={item} />
                </button>
            </div>
            <p className='code-caption'>
                {item.file}{item.line ? `:${item.line}` : ''} · {statusNames[reviewStatus(item)]}
            </p>
            {error && (
                <div role='alert'>
                    {error} <button onClick={() => load()}>Retry</button>
                </div>
            )}
            {!detail && !error && <p role='status'>Loading source…</p>}
            {reviewOpen && (
                <ReviewHistory
                    item={item}
                    detail={detail}
                    canReview={canReview}
                    busy={busy}
                    more={more}
                    onApprove={approve}
                    onLoadMore={loadOlderReviews}
                />
            )}
            <details>
                <summary>SHA-256 and version details</summary>
                <code>Source: {item.sha256}<br />With dependencies: {item.reviewHash}</code>
            </details>
            <details open>
                <summary>Full content</summary>
                {detail && <pre tabIndex={0}><code>{detail.item.content}</code></pre>}
            </details>
            {item.unresolved.length > 0 && (
                <details>
                    <summary>References to inspect ({item.unresolved.length})</summary>
                    <ul>{item.unresolved.map(reference => <li key={reference}>{reference}</li>)}</ul>
                </details>
            )}
            <details open>
                <summary>Direct dependencies ({item.dependencies.length})</summary>
                <DependencyLinks ids={item.dependencies} byId={byId} onSelect={onSelect} />
            </details>
            <details>
                <summary>All source files used by this item ({sourceDependencies.length})</summary>
                <ul className='code-links'>
                    {sourceDependencies.map(node => (
                        <li key={node.id}>
                            <button onClick={() => onSelect(node.id)}>
                                <ItemIcon item={node} />
                                <span>{node.title}</span>
                                <StatusIcon item={node} />
                            </button>
                        </li>
                    ))}
                </ul>
            </details>
        </article>
    )
}

function DependencyLinks({ ids, byId, onSelect }: {
    ids: string[]
    byId: Map<string, CodeItem>
    onSelect: (id: string) => void
}) {
    return (
        <ul className='code-links'>
            {ids.map(id => {
                const node = byId.get(id)
                if (!node) return null
                return (
                    <li key={id}>
                        <button onClick={() => onSelect(id)}>
                            <ItemIcon item={node} />
                            <span>{node.title}</span>
                            <StatusIcon item={node} />
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}
