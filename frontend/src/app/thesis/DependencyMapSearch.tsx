import type { RefObject } from 'react'
import { Search, X } from 'lucide-react'
import type { CodeItem } from '@/utils/codeReviewTypes'
import { ItemIcon } from './codeReviewShared'

type Props = {
    query: string
    matches: CodeItem[]
    inputRef: RefObject<HTMLInputElement | null>
    onQueryChange: (value: string) => void
    onSelect: (id: string) => void
    onClose: () => void
}

export function DependencyMapSearch({ query, matches, inputRef, onQueryChange, onSelect, onClose }: Props) {
    return (
        <div className='code-map-search' role='search' aria-label='Dependency map search'>
            <div className='code-map-search-input'>
                <Search size={16} />
                <input
                    ref={inputRef}
                    aria-label='Find in dependency map'
                    placeholder='Search routes, queries or files'
                    value={query}
                    onChange={event => onQueryChange(event.target.value)}
                    onKeyDown={event => {
                        if (event.key !== 'Enter' || !matches[0]) return
                        event.preventDefault()
                        onSelect(matches[0].id)
                        onClose()
                    }}
                />
                <button aria-label='Close map search' onClick={onClose}><X size={15} /></button>
            </div>
            {query.trim() && <div className='code-map-search-results'>
                <ul className='code-links'>{matches.slice(0, 50).map(item => (
                    <li key={item.id}>
                        <button onClick={() => { onSelect(item.id); onClose() }}>
                            <ItemIcon item={item} />
                            <span>{item.title}</span>
                        </button>
                    </li>
                ))}</ul>
                <p className='code-caption' role='status'>
                    {matches.length
                        ? `${matches.length} matches${matches.length > 50 ? ' · Showing the first 50. Refine your search to narrow the results.' : ''}`
                        : 'No matching items.'}
                </p>
            </div>}
        </div>
    )
}
