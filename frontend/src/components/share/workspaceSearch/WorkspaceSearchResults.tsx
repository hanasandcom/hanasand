import { ChevronDown, ChevronRight } from 'lucide-react'
import type { WorkspaceFileMatches } from './types'
import { WorkspaceMatchLink } from './WorkspaceMatchLink'

type Props = {
    query: string
    loading: boolean
    caseSensitive: boolean
    results: WorkspaceFileMatches[]
    expanded: Set<string>
    onToggleExpanded: (id: string) => void
}

export function WorkspaceSearchResults({ query, loading, caseSensitive, results, expanded, onToggleExpanded }: Props) {
    return <div className='min-h-0 flex-1 overflow-auto p-2'>
        {!query.trim() ? <EmptyState title='Search everything' body='Find and replace across this share without leaving the workspace.' /> : null}
        {query.trim() && !loading && results.length === 0 ? <EmptyState title='No matches' body='Try a broader query or adjust include/exclude filters.' /> : null}
        {results.map(group => {
            const isOpen = expanded.has(group.file.id)
            return <article key={group.file.id} className='mb-2 overflow-hidden rounded-xl border border-ui-border bg-ui-raised'>
                <button type='button' onClick={() => onToggleExpanded(group.file.id)} className='flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-ui-panel'>
                    {isOpen ? <ChevronDown className='h-4 w-4 text-ui-muted' /> : <ChevronRight className='h-4 w-4 text-ui-muted' />}
                    <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium text-ui-text'>{group.file.name}</p>
                        <p className='truncate text-[11px] text-ui-muted'>{group.file.path}</p>
                    </div>
                    <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[11px] text-ui-muted'>{group.matches.length}</span>
                </button>
                {isOpen ? <div className='border-t border-ui-border py-1'>
                    {group.matches.slice(0, 80).map(match => <WorkspaceMatchLink key={match.id} match={match} query={query} caseSensitive={caseSensitive} />)}
                </div> : null}
            </article>
        })}
    </div>
}

function EmptyState({ title, body }: { title: string, body: string }) {
    return <div className='grid min-h-48 place-items-center rounded-xl border border-dashed border-ui-border bg-ui-raised p-6 text-center'>
        <div>
            <p className='text-sm font-semibold text-ui-text'>{title}</p>
            <p className='mt-2 text-xs leading-5 text-ui-muted'>{body}</p>
        </div>
    </div>
}
