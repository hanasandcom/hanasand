'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { FolderKanban } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { type NavigationPreferences } from '@/utils/layout/navigationPreferences'
import { getDashboardViewMode, setDashboardViewMode } from '@/utils/layout/viewMode'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import { getThesisNavigation } from '@/utils/layout/thesisNavigation'
import { pinnedNavigation, type NavigationAccess, type NavigationItem } from '@/utils/layout/dashboardNavigation'
import { useDashboardSidebarVmPresence } from './useDashboardSidebarVmPresence'
import { useDashboardSidebarSupport } from './useDashboardSidebarSupport'
import { useDashboardSidebarNavigation } from './useDashboardSidebarNavigation'
import { useDashboardSidebarPreferences } from './useDashboardSidebarPreferences'
import { useDashboardSidebarPreview, DashboardSidebarPreviewPanel } from './dashboardSidebarPreview'
import { DashboardSidebarGroup, DashboardSidebarLink, PendingBadge, sectionIcons } from './dashboardSidebarMenu'
import { DashboardSidebarHeader } from './dashboardSidebarHeader'
import { Sidebar } from 'hanasand'

const emptyThesisNavigation: ReturnType<typeof getThesisNavigation> = []

export default function DashboardSidebar({ initialPreferences = { expanded: {}, pinned: [] }, initialMode = 'normal', thesisSheets: initialThesisSheets = emptyThesisNavigation, ...access }: NavigationAccess & { initialPreferences?: NavigationPreferences; initialMode?: 'normal' | 'compact' }) {
    const { organizationId, organizations } = useWorkspace()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const domId = useId()
    const storageKey = `dashboard-navigation:v1:${access.id}`
    const [query, setQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const searchButton = useRef<HTMLButtonElement | null>(null)
    const mode = useSyncExternalStore(onChange => {
        window.addEventListener('dashboard-view-mode', onChange)
        return () => window.removeEventListener('dashboard-view-mode', onChange)
    }, () => getDashboardViewMode(), () => initialMode)
    const desktop = useSyncExternalStore(onChange => {
        const media = window.matchMedia('(min-width: 1024px)')
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, () => window.matchMedia('(min-width: 1024px)').matches, () => true)
    const compact = desktop && mode === 'compact'
    const hasVMs = useDashboardSidebarVmPresence(access.id)
    const { hasUnreadSupport } = useDashboardSidebarSupport(access.id, pathname)
    const { sections, links, active, activePath } = useDashboardSidebarNavigation({
        access,
        organizations,
        organizationId,
        hasVMs,
        initialThesisSheets,
        pathname,
        searchParams,
    })
    const preferencesState = useDashboardSidebarPreferences({
        userId: access.id,
        storageKey,
        pathname,
        activePath,
        initialPreferences,
        sections,
        links,
    })
    const { preferences, favorites, save, isExpanded, toggle, collapseAll, pin } = preferencesState
    const previewState = useDashboardSidebarPreview(preferences)
    const { preview, previewPanel, showPreview, deferPreviewClose, cancelPreviewClose, closePreview } = previewState
    const communicationSummary = hasUnreadSupport ? 'unread support chats' : ''
    const search = query.trim().toLocaleLowerCase()
    const hasExpandedMenu = !search && (sections.some(section => section.items && isExpanded(section.label)) || (favorites.length > 0 && isExpanded('Pinned')))
    const matches = search ? links.filter(item => [...item.ancestors, item.label].join(' ').toLocaleLowerCase().includes(search)) : []

    useEffect(() => {
        setQuery('')
        setSearchOpen(false)
    }, [pathname, activePath])

    function renderLink(item: { label: string; href: string }, key = item.href) {
        return <DashboardSidebarLink key={key} linkKey={key} item={item} active={active} preferences={preferences} hasUnreadSupport={hasUnreadSupport} onPin={pin} />
    }

    function renderGroup(item: NavigationItem) {
        return <DashboardSidebarGroup key={item.label} item={item} domId={domId} activePath={activePath} preferences={preferences} communicationSummary={communicationSummary} onToggle={toggle} renderLink={renderLink} />
    }

    return <Sidebar aria-label='Dashboard sidebar' className={`site-chrome dashboard-sidebar-sticky noscroll min-h-0 w-full overflow-auto rounded-lg border border-ui-border bg-ui-panel text-ui-text p-2 shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20 ${compact ? 'lg:w-16' : 'lg:w-58'}`}>
        <DashboardSidebarHeader domId={domId} route={pathname} compact={compact} hasExpandedMenu={hasExpandedMenu} searchOpen={searchOpen} setSearchOpen={setSearchOpen} query={query} setQuery={setQuery} searchButton={searchButton} onCollapseAll={() => { collapseAll(); setQuery('') }} />
        <nav aria-label='Main navigation' onMouseLeave={deferPreviewClose} className='grid gap-1'>
            {compact ? sections.map(section => {
                const Icon = sectionIcons[section.label] || FolderKanban
                if (section.href) return <Link key={section.href} href={section.href} aria-label={section.label} title={section.label} aria-current={active?.href === section.href ? 'page' : undefined}
                    className={`grid h-10 w-full place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-ui-primary ${active?.href === section.href ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-canvas'}`}><Icon className='h-4 w-4' /></Link>
                return <button key={section.label} type='button'
                    aria-label={section.label === 'Communication' && communicationSummary ? `Open Communication, ${communicationSummary}` : `Open ${section.label}`}
                    title={section.label === 'Communication' && communicationSummary ? `Communication · ${communicationSummary}` : section.label}
                    onMouseEnter={event => showPreview(section, event.currentTarget)} onFocus={event => showPreview(section, event.currentTarget)}
                    onClick={() => { save({ ...preferences, expanded: { ...preferences.expanded, [section.label]: true } }); setDashboardViewMode('normal'); closePreview() }}
                    className={`relative grid h-10 w-full place-items-center rounded-md hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary ${activePath.startsWith(section.label) ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted'}`}>
                    <Icon className='h-4 w-4' />
                    {section.label === 'Communication' && communicationSummary && preview?.section.label !== section.label ? <PendingBadge className='absolute right-0 top-0' /> : null}
                </button>
            }) : search ? <div aria-label='Navigation search results'>
                <p role='status' className='px-2 py-1 text-xs text-ui-muted'>{matches.length} matching pages</p>
                {matches.map(item => <div key={item.href} className='mb-2'>
                    <p className='px-2 text-[10px] text-ui-muted'>{item.ancestors.join(' › ')}</p>
                    {renderLink(item)}
                </div>)}
            </div> : <>
                {favorites.length > 0 && renderGroup({ label: 'Pinned', items: pinnedNavigation(favorites) })}
                {sections.map(section => section.items ? renderGroup(section) : section.href ? renderLink({ label: section.label, href: section.href }) : null)}
            </>}
        </nav>
        {compact && preview && <DashboardSidebarPreviewPanel preview={preview} panelRef={previewPanel} domId={domId} active={active} hasUnreadSupport={hasUnreadSupport} preferences={preferences} onToggle={toggle} onClose={closePreview} onMouseEnter={cancelPreviewClose} onMouseLeave={deferPreviewClose} />}
        <nav aria-label='Status shortcut' className='mt-2 grid gap-1 border-t border-ui-border pt-2 lg:hidden'>
            <Link href='/status' className='rounded-md px-2 py-2 text-sm text-ui-muted hover:bg-ui-canvas hover:text-ui-text'>Status</Link>
        </nav>
    </Sidebar>
}
