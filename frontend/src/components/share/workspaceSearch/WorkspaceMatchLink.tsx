import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { WorkspaceMatch } from './types'

type Props = {
    match: WorkspaceMatch
    query?: string
    caseSensitive?: boolean
}

export function WorkspaceMatchLink({ match, query, caseSensitive = false }: Props) {
    const href = `/s/${match.file.id}?line=${match.line}${query === undefined ? '' : `&q=${encodeURIComponent(query)}`}`
    return (
        <Link prefetch={false} href={href} className='group flex gap-2 px-3 py-2 text-xs transition hover:bg-ui-primary/10'>
            <span className='w-8 shrink-0 text-right font-mono text-ui-muted'>{match.line}</span>
            <span className='min-w-0 flex-1'>
                {match.functionName ? <span className='mb-1 block text-[10px] uppercase tracking-[0.16em] text-ui-primary'>{match.functionName}</span> : null}
                <MatchPreview preview={match.preview} query={query} caseSensitive={caseSensitive} />
            </span>
            <ArrowRight className='mt-0.5 h-3.5 w-3.5 shrink-0 text-ui-muted transition group-hover:text-ui-primary' />
        </Link>
    )
}

function MatchPreview({ preview, query, caseSensitive }: { preview: string, query?: string, caseSensitive: boolean }) {
    const index = !query ? -1 : caseSensitive
        ? preview.indexOf(query)
        : preview.toLowerCase().indexOf(query.toLowerCase())
    if (query === undefined) return <span className='block truncate font-mono text-ui-muted'>{preview}</span>
    if (index < 0 || !query) return <span className='truncate text-ui-muted'>{preview}</span>
    return (
        <span className='block truncate font-mono text-ui-muted'>
            {preview.slice(0, index)}
            <mark className='rounded bg-ui-primary/20 px-0.5 text-ui-on-primary'>{preview.slice(index, index + query.length)}</mark>
            {preview.slice(index + query.length)}
        </span>
    )
}
