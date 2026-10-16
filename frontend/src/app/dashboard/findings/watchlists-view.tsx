import type { ReactNode } from 'react'
import Link from '@/components/organizations/workspaceLink'
import { CreateCase } from '../cases/create-case'
import type { WatchlistOverview, WatchlistOverviewState } from './types'

export function WatchlistsView({ organizationId, state, workflowActions }: { organizationId?: string, state: WatchlistOverviewState, workflowActions: ReactNode }) {
    const overview = state.data
    const unavailable = state.status === 'error' ? 'Unavailable' : '…'
    const summaryCards: Array<{ label: string, value: string, href?: string }> = [
            { label: 'Watchlists', value: overview ? String(overview.watchlistCount) : unavailable },
            { label: 'Watched terms', value: overview ? String(overview.watchedTermCount) : unavailable },
            { label: 'Findings', value: overview ? String(overview.findingsCount) : unavailable, href: '/findings' },
            { label: 'Destinations', value: overview?.destinationsCount === undefined ? unavailable : String(overview.destinationsCount), href: '/findings/delivery' },
            { label: 'Cases', value: overview?.caseCount === undefined ? unavailable : String(overview.caseCount), href: '/cases' },
        ]
    return (
            <div className='grid gap-4'>
                <header className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                    <h1 className='text-xl font-semibold text-ui-text'>Watchlists</h1>
                    <div className='flex flex-wrap items-center gap-2'>
                        <CreateCase organizationId={organizationId} />
                        <WatchlistActionLink href='/ti/sources?scope=global&available=true'>Add source</WatchlistActionLink>
                        <WatchlistActionLink href='/findings'>Findings</WatchlistActionLink>
                        <WatchlistActionLink href='/findings/delivery'>Delivery</WatchlistActionLink>
                    </div>
                </header>

                <section aria-label='Watchlist summary' className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'>
                    {summaryCards.map(card => {
                        const contents = (
                            <>
                                <h2 className='text-sm font-medium text-ui-muted'>{card.label}</h2>
                                <p className='mt-2 text-2xl font-semibold tabular-nums text-ui-text'>{card.value}</p>
                            </>
                        )
                        return card.href ? (
                            <Link key={card.label} href={card.href} className='block rounded-lg border border-ui-border bg-ui-panel p-3 text-left shadow-sm transition-colors hover:bg-ui-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'>
                                {contents}
                            </Link>
                        ) : (
                            <article key={card.label} className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm'>
                                {contents}
                            </article>
                        )
                    })}
                </section>

                <section id='watchlists' className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                    <div className='border-b border-ui-border px-4 py-3'>
                        <h2 className='text-base font-semibold text-ui-text'>Watchlists</h2>
                    </div>
                    {state.status === 'loading' && !overview ? <p className='px-4 py-5 text-sm text-ui-muted'>Loading…</p> : null}
                    {state.status === 'error' && !overview ? <p className='px-4 py-5 text-sm text-ui-muted'>Watchlists unavailable. {state.error}</p> : null}
                    {overview && !overview.watchlists.length ? <p className='px-4 py-5 text-sm text-ui-muted'>No watchlists yet.</p> : null}
                    {overview?.watchlists.length ? (
                        <div className='divide-y divide-ui-border'>
                            {overview.watchlists.map(watchlist => (
                                <details key={watchlist.id} className='group px-4'>
                                    <summary className='flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm marker:hidden'>
                                        <span aria-hidden='true' className='text-ui-muted transition-transform group-open:rotate-90'>›</span>
                                        <span className='min-w-0 flex-1 font-medium text-ui-text'>{watchlist.name}</span>
                                        <span className='text-ui-muted'>{watchlist.terms.length} terms</span>
                                        <span className='rounded-full border border-ui-border px-2 py-0.5 text-xs capitalize text-ui-muted'>{watchlist.status}</span>
                                    </summary>
                                    {watchlist.terms.length ? (
                                        <ul className='grid gap-2 pb-4 pl-7 sm:grid-cols-2 lg:grid-cols-3'>
                                            {watchlist.terms.map((term, index) => (
                                                <li key={`${watchlist.id}:${term.kind}:${term.value}:${index}`} className='flex min-w-0 items-center justify-between gap-3 rounded-md bg-ui-raised px-3 py-2 text-sm'>
                                                    <span className='min-w-0 truncate text-ui-text'>{term.value}</span>
                                                    <span className='shrink-0 text-xs capitalize text-ui-muted'>{term.kind}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <p className='pb-4 pl-7 text-sm text-ui-muted'>No terms.</p>}
                                </details>
                            ))}
                        </div>
                    ) : null}
                </section>

                <section id='watchlist-editor' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                    <h2 className='mb-3 text-base font-semibold text-ui-text'>Add watchlist terms</h2>
                    {workflowActions}
                </section>
            </div>
    )
}

function WatchlistActionLink({ href, children }: { href: string, children: ReactNode }) {
    return <Link href={href} className='inline-flex min-h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm transition-colors hover:bg-ui-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'>{children}</Link>
}
