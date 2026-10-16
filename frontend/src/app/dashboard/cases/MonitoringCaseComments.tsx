import { ChevronDown, Filter, Search } from 'lucide-react'
import type { MonitoringCase } from './monitoringCaseTypes'
import { date } from './monitoringCaseText'

const control = 'rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text disabled:cursor-not-allowed disabled:opacity-50'

export function MonitoringCaseComments({ item, comments, comment, setComment, busy, save, commentsOpen, setCommentsOpen, commentFiltersOpen, setCommentFiltersOpen, commentSearch, setCommentSearch, hideAutomatedComments, setHideAutomatedComments }: {
    item: MonitoringCase
    comments: MonitoringCase['comments']
    comment: string
    setComment: (value: string) => void
    busy: boolean
    save: (change: Record<string, unknown>) => void
    commentsOpen: boolean
    setCommentsOpen: (value: boolean | ((current: boolean) => boolean)) => void
    commentFiltersOpen: boolean
    setCommentFiltersOpen: (value: boolean | ((current: boolean) => boolean)) => void
    commentSearch: string
    setCommentSearch: (value: string) => void
    hideAutomatedComments: boolean
    setHideAutomatedComments: (value: boolean) => void
}) {
    const query = commentSearch.trim().toLocaleLowerCase()
    const visibleComments = comments.filter(entry => {
        const automated = entry.actorType === 'automation' || entry.author.trim().toLocaleLowerCase() === 'health monitoring'
        return !(hideAutomatedComments && automated) && (!query || `${entry.author} ${entry.body}`.toLocaleLowerCase().includes(query))
    })

    return <div className='p-5 sm:p-6'>
        <div className='relative'>
            <div className='flex items-center gap-3'>
                <h2 className='min-w-0 flex-1 text-lg font-semibold'>
                    <button id='case-comments-heading' type='button' aria-expanded={commentsOpen} aria-controls='case-comments-content' onClick={() => setCommentsOpen(value => !value)} className='inline-flex items-center gap-2 text-left'>
                        Comments <ChevronDown aria-hidden='true' className={`h-4 w-4 transition-transform ${commentsOpen ? 'rotate-180' : ''}`} />
                    </button>
                </h2>
                <span className='whitespace-nowrap text-sm text-ui-muted'>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
                <button type='button' aria-label='Filter comments' aria-expanded={commentFiltersOpen} aria-controls='case-comment-filters' onClick={() => setCommentFiltersOpen(value => !value)} className='inline-flex h-9 w-9 items-center justify-center rounded-md border border-ui-border text-ui-muted hover:bg-ui-canvas hover:text-ui-text'>
                    <Filter aria-hidden='true' className='h-4 w-4' />
                </button>
            </div>
            {commentFiltersOpen && <div id='case-comment-filters' role='group' aria-label='Comment filters' className='absolute right-0 z-10 mt-2 grid w-[min(20rem,calc(100vw-3rem))] gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-lg'>
                <label className='grid gap-1.5 text-sm font-medium'>
                    Search comments
                    <span className='relative'>
                        <Search aria-hidden='true' className='absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                        <input type='search' aria-label='Search comments' value={commentSearch} onChange={event => setCommentSearch(event.target.value)} placeholder='Search text or author' className='h-9 w-full rounded-md border border-ui-border bg-ui-canvas pl-9 pr-3 text-sm font-normal text-ui-text' />
                    </span>
                </label>
                <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={hideAutomatedComments} onChange={event => setHideAutomatedComments(event.target.checked)} />Hide automated comments</label>
                {(commentSearch || hideAutomatedComments) && <button type='button' className='justify-self-start text-sm text-ui-primary underline' onClick={() => { setCommentSearch(''); setHideAutomatedComments(false) }}>Clear filters</button>}
            </div>}
        </div>
        <div id='case-comments-content' role='region' aria-labelledby='case-comments-heading' hidden={!commentsOpen} className='mt-4 grid gap-4'>
            {comments.length ? <>
                {visibleComments.map(entry => <article className='rounded-lg border border-ui-border p-4' key={entry.id}>
                    <p className='wrap-break-word text-sm text-ui-muted'>{entry.author} · {date(entry.createdAt)}</p>
                    <p className='mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]'>{entry.body}</p>
                </article>)}
                {visibleComments.length === 0 && <p className='text-sm text-ui-muted'>No comments match these filters.</p>}
            </> : <p className='text-sm text-ui-muted'>No comments yet.</p>}
            <form className='grid gap-3' onSubmit={event => {
                event.preventDefault()
                if (comment.trim() && !busy) save({ comment })
            }}>
                <label htmlFor='case-comment' className='text-sm font-medium'>Add a comment</label>
                <textarea id='case-comment' className={`${control} min-h-28 w-full`} value={comment} onChange={event => setComment(event.target.value)} maxLength={5000} disabled={busy || item.canManage === false} placeholder='Share an update or investigation notes…' required />
                <button type='submit' className={`${control} justify-self-start`} disabled={busy || item.canManage === false || !comment.trim()}>Post comment</button>
            </form>
        </div>
    </div>
}
