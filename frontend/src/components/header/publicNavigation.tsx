'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { ActivityIcon, BellRing, BookOpen, ChevronDown, Code2, FileJson, Gauge, LockKeyhole, MenuIcon, Radar, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useMobileNavigation } from '@/components/layout/mobileNavigation'

const productItems = [
    { title: 'Dark Web Monitoring', detail: 'Company and vendor alerts from watched exposure sources.', href: '/findings', icon: BellRing },
    { title: 'Security Monitoring', detail: 'Find suspicious logins and other security events.', href: '/solutions/security-monitoring', icon: ShieldAlert },
    { title: 'Security Scanner', detail: 'Safe validation scans for approved Hanasand assets.', href: '/solutions/scanner', icon: ShieldAlert },
    { title: 'Threat Search', detail: 'Search companies, groups, source changes, and alert context.', href: '/ti', icon: Radar },
    { title: 'Browser Sandbox', detail: 'Investigate websites in an isolated browser session.', href: '/sandbox', icon: Code2 },
    { title: 'Organizations', detail: 'Manage members, shared watchlists, alert scope, and destinations.', href: '/organizations', icon: ShieldCheck },
]

const developerItems = [
    { title: 'API overview', detail: 'Get started with the Hanasand API.', href: '/developers', icon: Code2 },
    { title: 'API keys and onboarding', detail: 'Create an organization, get a key, and make your first request.', href: '/developers#api-access', icon: ShieldCheck },
    { title: 'API reference', detail: 'Browse endpoints, access requirements, and key scopes.', href: '/developers#endpoints', icon: BookOpen },
    { title: 'TypeScript client', detail: 'Generate types and connect your application.', href: '/developers#clients', icon: Code2 },
    { title: 'OpenAPI JSON', detail: 'Download the API specification.', href: '/api/openapi/ti', icon: FileJson },
]

const resourceItems = [
    { title: 'Status', detail: 'Service health and current uptime.', href: '/status', icon: ActivityIcon },
    { title: 'Service Checks', detail: 'Permitted endpoint checks for URLs you control.', href: '/test', icon: Gauge },
    { title: 'Check Password', detail: 'Check a password hash while sending only a short prefix.', href: '/pwned', icon: LockKeyhole },
    { title: 'About Hanasand', detail: 'Product notes, ownership, and current Hanasand direction.', href: '/about', icon: BookOpen },
]

const navigationGroups = [
    { label: 'Product', items: productItems },
    { label: 'Developers', items: developerItems },
    { label: 'Resources', items: resourceItems },
]

type NavigationItem = typeof productItems[number]

export function PublicDesktopNavigation() {
    return (
        <nav aria-label='Main navigation' className='mr-auto hidden items-center gap-3 xl:flex'>
            {navigationGroups.map(group => <PublicDropdown key={group.label} {...group} />)}
        </nav>
    )
}

function NavigationLinks({ items, onNavigate }: { items: NavigationItem[], onNavigate?: () => void }) {
    return items.map((item) => {
        const Icon = item.icon
        return (
            <Link key={item.title} href={item.href} onClick={onNavigate} className='grid grid-cols-[2.5rem_1fr] gap-3 rounded-lg p-3 transition hover:bg-ui-raised'>
                <span className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                    <Icon className='h-4.5 w-4.5' />
                </span>
                <span className='grid min-w-0 gap-0.5'>
                    <span className='text-sm font-semibold text-ui-text'>{item.title}</span>
                    <span className='text-xs leading-5 text-ui-muted'>{item.detail}</span>
                </span>
            </Link>
        )
    })
}

function PublicDropdown({ label, items }: { label: string, items: NavigationItem[] }) {
    return (
        <div className='group relative'>
            <button className='inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text group-hover:bg-ui-raised' aria-haspopup='true'>
                {label}
                <ChevronDown className='h-4 w-4 text-ui-muted' />
            </button>
            <div className='invisible pointer-events-none absolute left-0 top-10 z-10 h-3 w-[23rem] group-hover:visible group-hover:pointer-events-auto group-focus-within:visible group-focus-within:pointer-events-auto' aria-hidden='true' />
            <div className='invisible pointer-events-none absolute left-0 top-12 z-20 max-h-[calc(100dvh-6rem)] w-[23rem] overflow-y-auto translate-y-1 rounded-lg border border-ui-border bg-ui-panel p-2 opacity-0 shadow-[0_22px_70px_var(--ui-shadow)] transition group-hover:visible group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100'>
                <NavigationLinks items={items} />
            </div>
        </div>
    )
}

export function PublicMobileMenu({ token }: { token: boolean }) {
    const [open, setOpen] = useState(false)
    const menuId = useId()
    const mobile = useMobileNavigation()

    return (
        <div className='relative xl:hidden' onKeyDown={event => {
            if (event.key === 'Escape' && open) {
                setOpen(false)
                event.currentTarget.querySelector('button')?.focus()
            }
        }}>
            <button
                type='button'
                onClick={() => setOpen((next) => !next)}
                className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                aria-label={mobile.enabled ? (open ? 'Close site navigation' : 'Open site navigation') : (open ? 'Close navigation' : 'Open navigation')}
                aria-expanded={open}
                aria-controls={menuId}
            >
                {open ? <X className='h-5 w-5' /> : <MenuIcon className='h-5 w-5' />}
            </button>
            {open && (
                <nav id={menuId} aria-label='Mobile main navigation' className='fixed inset-x-3 top-20 z-30 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border border-ui-border bg-ui-panel p-2 shadow-[0_22px_70px_var(--ui-shadow)]'>
                    {navigationGroups.map(({ label, items }) => (
                        <details key={label} name={menuId} className='group'>
                            <summary className='flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised [&::-webkit-details-marker]:hidden'>
                                {label}
                                <ChevronDown className='h-4 w-4 text-ui-muted transition group-open:rotate-180' />
                            </summary>
                            <NavigationLinks items={items} onNavigate={() => setOpen(false)} />
                        </details>
                    ))}
                    {[
                        { label: 'Pricing', href: token ? '/subscription' : '/pricing' },
                        { label: 'Go to Dashboard', href: token ? '/dashboard' : '/login' },
                    ].map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className='flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised'>
                            {item.label}
                        </Link>
                    ))}
                </nav>
            )}
        </div>
    )
}
