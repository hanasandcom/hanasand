import Link from 'next/link'
import { House, ChevronsUp, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import type { RefObject } from 'react'
import { setDashboardViewMode } from '@/utils/layout/viewMode'

export function DashboardSidebarHeader({
    domId,
    route,
    compact,
    hasExpandedMenu,
    searchOpen,
    setSearchOpen,
    query,
    setQuery,
    searchButton,
    onCollapseAll,
}: {
    domId: string
    route: string
    compact: boolean
    hasExpandedMenu: boolean
    searchOpen: boolean
    setSearchOpen: (open: boolean) => void
    query: string
    setQuery: (query: string) => void
    searchButton: RefObject<HTMLButtonElement | null>
    onCollapseAll: () => void
}) {
    return <>
        <div className={`mb-2 flex ${compact ? 'flex-col items-center gap-1' : 'items-center justify-between px-2'}`}>
            <Link href='/dashboard' aria-label='Home' title='Home' aria-current={route === '/dashboard' ? 'page' : undefined}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-ui-primary ${route === '/dashboard' ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-canvas'}`}>
                <House aria-hidden='true' className='h-4 w-4' />
            </Link>
            <div className={`flex shrink-0 items-center ${compact ? 'flex-col' : ''}`}>
                {!compact && hasExpandedMenu && <button type='button' onClick={onCollapseAll} aria-label='Collapse all menus' title='Collapse all menus'
                    className='grid h-10 w-10 place-items-center rounded-lg text-ui-muted hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary'>
                    <ChevronsUp aria-hidden='true' className='h-4 w-4' />
                </button>}
                <button ref={searchButton} type='button' onClick={() => {
                    if (!searchOpen && compact) setDashboardViewMode('normal')
                    setSearchOpen(!searchOpen)
                    setQuery('')
                }} aria-label={searchOpen ? 'Close page search' : 'Find a page'} title={searchOpen ? 'Close page search' : 'Find a page'} aria-expanded={searchOpen} aria-controls={`${domId}-navigation-search`}
                className='grid h-10 w-10 place-items-center rounded-lg text-ui-muted hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary'>
                    <Search aria-hidden='true' className='h-4 w-4' />
                </button>
                <button type='button' onClick={() => setDashboardViewMode(compact ? 'normal' : 'compact')} aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
                    className='hidden h-10 w-10 place-items-center rounded-lg text-ui-muted hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary lg:grid'>
                    {compact ? <PanelLeftOpen className='h-4 w-4' /> : <PanelLeftClose className='h-4 w-4' />}
                </button>
            </div>
        </div>
        {!compact && searchOpen && <div className='relative mb-2'>
            <Search aria-hidden='true' className='pointer-events-none absolute left-2 top-3 h-4 w-4 text-ui-muted' />
            <input id={`${domId}-navigation-search`} type='search' aria-label='Find a page' placeholder='Find a page…' value={query} autoFocus
                onChange={event => setQuery(event.target.value)} onKeyDown={event => {
                    if (event.key !== 'Escape') return
                    setQuery('')
                    setSearchOpen(false)
                    searchButton.current?.focus()
                }}
                className='h-10 w-full min-w-0 rounded-md border border-ui-border bg-ui-canvas pl-8 pr-2 text-sm text-ui-text placeholder:text-ui-muted focus-visible:outline-2 focus-visible:outline-ui-primary' />
        </div>}
    </>
}
