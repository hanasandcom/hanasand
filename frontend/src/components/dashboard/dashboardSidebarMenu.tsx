import Link from 'next/link'
import { ChevronDown, FolderKanban, Pin, type LucideIcon, ShieldCheck, ListFilter, AlarmClockCheck, Server, NotebookText, Mail, Settings2, Code2, CircleUserRound } from 'lucide-react'
import type { NavigationItem } from '@/utils/layout/dashboardNavigation'
import type { SidebarActiveItem } from './useDashboardSidebarNavigation'
import type { NavigationPreferences } from '@/utils/layout/navigationPreferences'
import { isActiveDashboardNavigationPath } from './dashboardNavigationPath'

export const sectionIcons: Record<string, LucideIcon> = {
    'Security & intelligence': ShieldCheck,
    'Logs & rules': ListFilter,
    Automation: AlarmClockCheck,
    Infrastructure: Server,
    Workspace: NotebookText,
    Communication: Mail,
    Organization: FolderKanban,
    Administration: Settings2,
    Resources: Code2,
    Account: CircleUserRound,
    Pinned: Pin,
}

export function pendingLabelForHref(href: string, hasUnreadSupport: boolean) {
    return href === '/support' && hasUnreadSupport ? 'unread messages' : null
}

export function PendingBadge({ className = '' }: { className?: string }) {
    return <span aria-hidden='true' className={`grid h-4 w-4 shrink-0 place-items-center rounded-full bg-neutral-700 text-[10px] font-semibold leading-none text-white ${className}`}>1</span>
}

export function DashboardSidebarLink({ item, active, preferences, hasUnreadSupport, onPin, linkKey = item.href }: {
    item: { label: string; href: string }
    active: SidebarActiveItem
    preferences: NavigationPreferences
    hasUnreadSupport: boolean
    onPin: (href: string) => void
    linkKey?: string
}) {
    const pinned = preferences.pinned.includes(item.href)
    const pendingLabel = pendingLabelForHref(item.href, hasUnreadSupport)
    return <div key={linkKey} className='group flex min-w-0 items-center rounded-md hover:bg-ui-canvas'>
        <Link href={item.href} aria-current={active?.href === item.href ? 'page' : undefined}
            aria-label={pendingLabel ? `${item.label}, ${pendingLabel}` : undefined}
            data-thesis-sheet-link={item.href.startsWith('/thesis?sheet=') ? '' : undefined}
            onClick={event => {
                if (!item.href.startsWith('/thesis?sheet=') || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                window.history.pushState(null, '', item.href)
            }}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm leading-5 focus-visible:outline-2 focus-visible:outline-ui-primary ${active?.href === item.href ? 'bg-ui-primary/10 font-semibold text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}>
            <span className='min-w-0 flex-1'>{item.label}</span>
            {pendingLabel ? <PendingBadge /> : null}
        </Link>
        <button type='button' onClick={() => onPin(item.href)} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${item.label}`} aria-pressed={pinned}
            className={`grid h-8 w-7 shrink-0 place-items-center rounded text-ui-muted hover:text-ui-primary focus-visible:outline-2 focus-visible:outline-ui-primary ${pinned ? 'text-ui-primary' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100'}`}>
            <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} />
        </button>
    </div>
}

export function DashboardSidebarGroup({ item, ancestors = [], domId, activePath, preferences, communicationSummary, onToggle, renderLink }: {
    item: NavigationItem
    ancestors?: string[]
    domId: string
    activePath: string
    preferences: NavigationPreferences
    communicationSummary: string
    onToggle: (key: string) => void
    renderLink: (item: { label: string; href: string }) => React.ReactNode
}) {
    const path = [...ancestors, item.label]
    const key = path.join('/')
    const containsActive = isActiveDashboardNavigationPath(activePath, key)
    const expanded = containsActive || preferences.expanded[key] === true
    const Icon = sectionIcons[item.label] || FolderKanban
    const controls = `${domId}-${encodeURIComponent(key)}`
    const pendingSummary = item.label === 'Communication' ? communicationSummary : ''
    return <div className={ancestors.length ? 'min-w-0' : 'min-w-0 border-t border-ui-border/50 pt-1 first:border-0'}>
        <button type='button' aria-expanded={expanded} aria-controls={controls}
            aria-label={!expanded && pendingSummary ? `${item.label}, ${pendingSummary}` : undefined}
            onClick={() => onToggle(key)}
            className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm leading-5 hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary ${containsActive ? 'text-ui-primary' : 'text-ui-text'} ${ancestors.length ? 'font-medium' : 'font-semibold'}`}>
            {!ancestors.length && <Icon className='h-4 w-4 shrink-0' />}
            <span className='min-w-0 flex-1'>{item.label}</span>
            {!expanded && pendingSummary ? <PendingBadge /> : null}
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <div id={controls} hidden={!expanded} className='ml-2 border-l border-ui-border pl-2'>
            {item.items?.map(child => child.items
                ? <DashboardSidebarGroup key={`${key}/${child.label}`} item={child} ancestors={path} domId={domId} activePath={activePath} preferences={preferences} communicationSummary={communicationSummary} onToggle={onToggle} renderLink={renderLink} />
                : child.href ? renderLink({ label: child.label, href: child.href }) : null)}
        </div>
    </div>
}
