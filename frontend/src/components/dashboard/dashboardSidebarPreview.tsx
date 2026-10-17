import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { NavigationItem } from '@/utils/layout/dashboardNavigation'
import type { SidebarActiveItem } from './useDashboardSidebarNavigation'
import { PendingBadge, pendingLabelForHref } from './dashboardSidebarMenu'
import type { NavigationPreferences } from '@/utils/layout/navigationPreferences'
import { isActiveDashboardNavigationPath } from './dashboardNavigationPath'

export type SidebarPreview = { section: NavigationItem; anchorTop: number; top: number; maxHeight: number }

export function useDashboardSidebarPreview(preferences: NavigationPreferences) {
    const [preview, setPreview] = useState<SidebarPreview | null>(null)
    const previewCloseTimer = useRef<number | null>(null)
    const previewPanel = useRef<HTMLDivElement | null>(null)

    function previewMinTop() {
        const headerBottom = document.querySelector<HTMLElement>('[data-site-header]')?.getBoundingClientRect().bottom ?? 72
        return headerBottom + 16
    }

    function previewMaxHeight() {
        return Math.max(0, window.innerHeight - previewMinTop() - 16)
    }

    useEffect(() => {
        if (!preview) return
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setPreview(null)
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [preview])

    useLayoutEffect(() => {
        if (!preview || !previewPanel.current) return
        const updateBounds = () => {
            const minTop = previewMinTop()
            const maxHeight = previewMaxHeight()
            const panelHeight = Math.min(previewPanel.current?.scrollHeight ?? maxHeight, maxHeight)
            const top = Math.max(minTop, Math.min(preview.anchorTop, window.innerHeight - 16 - panelHeight))
            setPreview(current => current && (current.top !== top || current.maxHeight !== maxHeight)
                ? { ...current, top, maxHeight }
                : current)
        }
        updateBounds()
        window.addEventListener('resize', updateBounds)
        return () => window.removeEventListener('resize', updateBounds)
    }, [preview, preferences.expanded])

    function showPreview(section: NavigationItem, element: HTMLElement) {
        if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current)
        const bounds = element.getBoundingClientRect()
        setPreview({ section, anchorTop: bounds.top, top: Math.max(previewMinTop(), bounds.top), maxHeight: previewMaxHeight() })
    }

    function deferPreviewClose() {
        if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current)
        previewCloseTimer.current = window.setTimeout(() => setPreview(null), 140)
    }

    function cancelPreviewClose() {
        if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current)
    }

    return { preview, previewPanel, showPreview, deferPreviewClose, cancelPreviewClose, closePreview: () => setPreview(null) }
}

export function DashboardSidebarPreviewPanel({ preview, panelRef, domId, active, hasUnreadSupport, preferences, onToggle, onClose, onMouseEnter, onMouseLeave }: {
    preview: SidebarPreview
    panelRef: React.RefObject<HTMLDivElement | null>
    domId: string
    active: SidebarActiveItem
    hasUnreadSupport: boolean
    preferences: NavigationPreferences
    onToggle: (key: string) => void
    onClose: () => void
    onMouseEnter: () => void
    onMouseLeave: () => void
}) {
    if (typeof document === 'undefined') return null
    return createPortal(<div ref={panelRef} role='region' aria-label={`${preview.section.label} navigation`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{ position: 'fixed', left: 80, top: preview.top, maxHeight: preview.maxHeight }}
        className='z-[200] w-72 overflow-y-auto rounded-xl border border-ui-border bg-ui-panel p-2 text-ui-text shadow-ui-panel'>
        <p className='px-3 py-2 text-sm font-semibold'>{preview.section.label}</p>
        <DashboardSidebarPreviewItems items={preview.section.items || []} ancestors={[preview.section.label]} domId={domId} active={active} hasUnreadSupport={hasUnreadSupport} preferences={preferences} onToggle={onToggle} onClose={onClose} />
    </div>, document.body)
}

function DashboardSidebarPreviewItems({ items, ancestors, domId, active, hasUnreadSupport, preferences, onToggle, onClose }: {
    items: NavigationItem[]
    ancestors: string[]
    domId: string
    active: SidebarActiveItem
    hasUnreadSupport: boolean
    preferences: NavigationPreferences
    onToggle: (key: string) => void
    onClose: () => void
}) {
    return items.map(item => {
        const path = [...ancestors, item.label]
        const key = path.join('/')
        if (item.items) {
            const expanded = isActiveDashboardNavigationPath((active?.ancestors || []).join('/'), key) || preferences.expanded[key] === true
            const controls = `${domId}-preview-${encodeURIComponent(key)}`
            return <div key={key} className='py-0.5'>
                <button type='button' aria-expanded={expanded} aria-controls={controls} onClick={() => onToggle(key)}
                    className='flex min-h-9 w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm font-medium text-ui-text hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary'
                    style={{ paddingLeft: 12 + ancestors.length * 12 }}>
                    <span className='min-w-0 flex-1'>{item.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                </button>
                <div id={controls} hidden={!expanded} className='border-l border-ui-border'>
                    <DashboardSidebarPreviewItems items={item.items} ancestors={path} domId={domId} active={active} hasUnreadSupport={hasUnreadSupport} preferences={preferences} onToggle={onToggle} onClose={onClose} />
                </div>
            </div>
        }
        if (!item.href) return null
        const pendingLabel = pendingLabelForHref(item.href, hasUnreadSupport)
        return <Link key={item.href} href={item.href} onClick={onClose} aria-current={active?.href === item.href ? 'page' : undefined}
            aria-label={pendingLabel ? `${item.label}, ${pendingLabel}` : undefined}
            className={`flex items-center gap-2 rounded-md py-2 pr-3 text-sm leading-5 hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary ${active?.href === item.href ? 'bg-ui-primary/10 font-semibold text-ui-primary' : 'text-ui-text'}`}
            style={{ paddingLeft: 12 + ancestors.length * 12 }}>
            <span className='min-w-0 flex-1'>{item.label}</span>
            {pendingLabel ? <PendingBadge /> : null}
        </Link>
    })
}
