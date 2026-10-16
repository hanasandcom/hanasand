import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { reviewPriority, type CodeItem } from '@/utils/codeReviewTypes'
import { kinds, names, ItemIcon, StatusIcon } from './codeReviewShared'

type Props = {
    scoped: CodeItem[]
    filtered: CodeItem[]
    selectedId?: string
    query: string
    scope: string
    order: string
    status: string
    limit: number
    onQueryChange: (value: string) => void
    onScopeChange: (value: string) => void
    onOrderChange: (value: string) => void
    onStatusChange: (value: string) => void
    onSelect: (id: string) => void
    onShowMore: () => void
    children: ReactNode
}

export function CodeInventoryPanel({
    scoped,
    filtered,
    selectedId,
    query,
    scope,
    order,
    status,
    limit,
    onQueryChange,
    onScopeChange,
    onOrderChange,
    onStatusChange,
    onSelect,
    onShowMore,
    children,
}: Props) {
    return (
        <>
            <div className='code-filters'>
                <label>
                    <Search size={15} />
                    <input
                        aria-label='Search code inventory'
                        placeholder='Search routes, queries or files'
                        value={query}
                        onChange={event => onQueryChange(event.target.value)}
                    />
                </label>
                <select
                    aria-label='Repository scope'
                    value={scope}
                    onChange={event => onScopeChange(event.target.value)}
                >
                    <option value='website'>Website, API and database</option>
                    <option value='repository'>Entire repository</option>
                </select>
                <select
                    aria-label='Sort code inventory'
                    value={order}
                    onChange={event => onOrderChange(event.target.value)}
                >
                    <option value='priority'>Priority, then alphabetical</option>
                    <option value='alphabetical'>Alphabetical</option>
                </select>
                <select
                    aria-label='Review filter'
                    value={status}
                    onChange={event => onStatusChange(event.target.value)}
                >
                    <option value='all'>All review states</option>
                    <option value='unreviewed'>Not reviewed</option>
                    <option value='changed'>Needs new review</option>
                    <option value='approved'>Approved</option>
                </select>
            </div>
            <p className='code-caption'>
                {scoped.filter(node => reviewPriority(node) > 0).length}/{scoped.length} files reviewed.
            </p>
            <div className='code-columns'>
                <aside aria-label='Alphabetical code inventory'>
                    {kinds.map(kind => {
                        const entries = filtered.filter(node => node.kind === kind)
                        return (
                            <details key={kind} open>
                                <summary>{names[kind]} <span>{entries.length}</span></summary>
                                <ul className='code-links'>
                                    {entries.slice(0, limit).map(node => (
                                        <li key={node.id}>
                                            <button
                                                aria-current={node.id === selectedId ? 'true' : undefined}
                                                onClick={() => onSelect(node.id)}
                                            >
                                                <ItemIcon item={node} />
                                                <span>{node.title}</span>
                                                <StatusIcon item={node} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {entries.length > limit && (
                                    <button className='code-more' onClick={onShowMore}>
                                        Show more ({entries.length - limit})
                                    </button>
                                )}
                            </details>
                        )
                    })}
                    {!filtered.length && <p>No matching items.</p>}
                </aside>
                <div className='code-main'>{children}</div>
            </div>
        </>
    )
}
