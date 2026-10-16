'use client'

import { usePathname } from 'next/navigation'
import ThemeSwitch from '@/components/theme/themeSwitch'
import { ArrowLeftRight, UserRound } from 'lucide-react'
import { isInternalAppPath, hasAppSidebar } from '@/utils/routes/appRoutes'
import Menu from '@/components/menu/menu'
import Link from 'next/link'
import isSharePath from '@/utils/routes/isSharePath'
import isPublicProductPath from '@/utils/routes/isPublicProductPath'
import BrandLogo from '@/components/brand/brandLogo'
import { useEffect, useState } from 'react'
import SiteSearch from './siteSearch'
import { PublicDesktopNavigation, PublicMobileMenu } from './publicNavigation'
import { OrganizationSwitcher } from '@/components/organizations/workspaceProvider'
import SupportAssistant from '@/components/support/supportAssistant'
import { useMobileNavigation } from '@/components/layout/mobileNavigation'
import { readRecentUsers, rememberCurrentUser, type RecentUser } from '@/utils/auth/savedProfiles'

export default function Header({ token, id, username, path: serverPath }: { token: boolean, id: string, username: string, path: string }) {
    const mobile = useMobileNavigation()
    const pathname = usePathname() || serverPath
    const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
    const isShare = isSharePath(pathname)
    const isAI = pathname.endsWith('/ai') || pathname.includes('/ai/')
    const isDashboard = isInternalAppPath(pathname)
    const isProfile = pathname.startsWith('/profile')
    const isAccountSwitcher = pathname === '/switch-account'
    const isPublicProduct = isPublicProductPath(pathname)
    const isLoggedInConsoleProduct = token && (pathname === '/ti' || pathname.startsWith('/ti/'))
    const isOrganizations = pathname.startsWith('/organizations')
    const isAppSurface = isDashboard || isAccountSwitcher || (token && hasAppSidebar(pathname)) || isLoggedInConsoleProduct || (!isPublicProduct && (isShare || isAI || isDashboard || isProfile || isOrganizations))
    const pricingHref = token ? '/subscription' : '/pricing'
    const profileHref = id ? `/profile/${encodeURIComponent(id)}` : '/profile'

    useEffect(() => {
        if (token && id) rememberCurrentUser()
        setRecentUsers(readRecentUsers())
    }, [id, token])

    return (
        <header data-site-header className='site-chrome fixed left-0 top-0 z-1000 w-full border-b border-ui-border bg-ui-panel text-ui-text px-3 sm:px-5 md:px-10 lg:px-16'>
            <div className='mx-auto flex h-18 w-full max-w-7xl items-center justify-between gap-2 sm:gap-5'>
                <BrandLogo compact={token} className='shrink-0' />

                <PublicDesktopNavigation pricingHref={pricingHref} />

                <div className='flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2'>
                    {token && <OrganizationSwitcher />}
                    <SiteSearch token={token} />
                    <span className='[&_button]:w-10'><ThemeSwitch /></span>
                    <Link href='/support' className='hidden h-10 min-w-20 items-center justify-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text lg:inline-flex'>Support</Link>
                    <Link href={token ? '/dashboard' : '/login'} className={`${token ? 'hidden sm:inline-flex' : 'inline-flex'} h-11 items-center gap-2 rounded-lg bg-ui-text px-3 text-sm font-semibold text-ui-canvas shadow-sm transition hover:opacity-90 sm:px-4`}>
                        <span className='sm:hidden'>Dashboard</span><span className='hidden sm:inline'>{token ? 'Dashboard' : 'Go to Dashboard'}</span>
                    </Link>
                    <details key={`account:${pathname}:${token ? 'signed-in' : 'signed-out'}`} className='relative' onMouseEnter={event => {
                        event.currentTarget.open = true
                    }} onMouseLeave={event => {
                        event.currentTarget.open = false
                    }} onKeyDown={event => {
                        if (event.key === 'Escape') {
                            event.currentTarget.open = false
                            event.currentTarget.querySelector('summary')?.focus()
                        }
                    }}>
                        <summary aria-label='Account options' className='grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg border border-ui-border text-ui-muted hover:bg-ui-raised hover:text-ui-text [&::-webkit-details-marker]:hidden'>
                            <UserRound className='h-5 w-5' />
                        </summary>
                        <div aria-hidden='true' className='fixed inset-x-3 top-14 z-20 h-4 bg-transparent sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:h-3 sm:w-60' />
                        <div className='fixed inset-x-3 top-18 z-30 grid max-h-[calc(100dvh-5rem)] gap-2 overflow-y-auto rounded-lg border border-ui-border bg-ui-panel p-3 text-sm text-ui-text shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-13 sm:w-60'>
                            {token ? <>
                                <div className='flex items-center gap-2 rounded-lg px-2 py-1'>
                                    <div className='min-w-0 flex-1 truncate font-mono text-xs text-ui-muted/70'>@{username || id}</div>
                                    <Link href='/switch-account' aria-label='Switch account' title='Switch account' className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>
                                        <ArrowLeftRight className='h-4 w-4' />
                                    </Link>
                                </div>
                                <div role='separator' className='border-t border-ui-border' />
                                <Link href={profileHref} className='rounded-lg p-2 hover:bg-ui-raised'>Profile</Link>
                                {id && <Link href={`/profile/${encodeURIComponent(id)}/security`} className='rounded-lg p-2 hover:bg-ui-raised'>Security</Link>}
                                {id && <Link href={`/profile/${encodeURIComponent(id)}/sessions`} className='rounded-lg p-2 hover:bg-ui-raised'>Sessions</Link>}
                                <div role='separator' className='border-t border-ui-border' />
                                <Link href='/logout' className='rounded-lg p-2 hover:bg-ui-raised'>Sign out</Link>
                            </> : <>
                                <Link href='/login' className='rounded-lg p-2 hover:bg-ui-raised'>Sign in</Link>
                                {recentUsers.length > 0 && <>
                                    <div role='separator' className='border-t border-ui-border' />
                                    <div className='grid gap-1'>
                                        <p className='px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-ui-muted'>Recently used</p>
                                        {recentUsers.slice(0, 6).map(user => (
                                            <Link
                                                key={user.id}
                                                href={`/login?path=%2Fdashboard&username=${encodeURIComponent(user.id)}`}
                                                onClick={event => {
                                                    event.preventDefault()
                                                    const currentPath = new URLSearchParams(window.location.search).get('path') || '/dashboard'
                                                    const query = new URLSearchParams({ path: currentPath, username: user.id })
                                                    window.location.assign(`/login?${query.toString()}`)
                                                }}
                                                aria-label={`Sign in as ${user.name}`}
                                                className='grid min-w-0 rounded-lg px-2 py-1.5 transition hover:bg-ui-raised'
                                            >
                                                <span className='truncate font-medium'>{user.name}</span>
                                                <span className='truncate font-mono text-xs text-ui-muted'>@{user.id}</span>
                                            </Link>
                                        ))}
                                        {recentUsers.length > 6 && <Link href='/switch-account' className='rounded-lg px-2 py-1.5 text-xs font-semibold text-ui-muted hover:bg-ui-raised hover:text-ui-text'>See all accounts</Link>}
                                    </div>
                                </>}
                            </>}
                        </div>
                    </details>
                    <PublicMobileMenu key={pathname} token={token} />
                    {mobile.enabled && <Menu />}
                </div>
            </div>
            <SupportAssistant internal={isAppSurface} />
        </header>
    )
}
