'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import ThemeSwitch from '@/components/theme/themeSwitch'
import { hasAppSidebar } from '@/utils/routes/appRoutes'
import Menu from '@/components/menu/menu'
import Link from 'next/link'
import SiteSearch from './siteSearch'
import AccountMenu from './accountMenu'
import { PublicDesktopNavigation, PublicMobileMenu } from './publicNavigation'
import { OrganizationSwitcher } from '@/components/organizations/workspaceProvider'
import SupportAssistant from '@/components/support/supportAssistant'
import { useMobileNavigation } from '@/components/layout/mobileNavigation'
import { isAppSurfacePath } from '@/components/layout/appSurface'
import { readRecentUsers, rememberCurrentUser, type RecentUser } from '@/utils/auth/savedProfiles'
import { Header as SharedHeader } from 'hanasand'

export default function Header({ token, id, username, path: serverPath }: { token: boolean, id: string, username: string, path: string }) {
    const mobile = useMobileNavigation()
    const pathname = usePathname() || serverPath
    const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
    const isAiWorkbench = pathname.startsWith('/ai') && pathname !== '/ai/window'
    const isAppSurface = isAppSurfacePath(pathname, {
        sidebarVisible: Boolean(token && hasAppSidebar(pathname)),
        loggedInTi: token && (pathname === '/ti' || pathname.startsWith('/ti/')),
        aiPath: pathname.endsWith('/ai') || pathname.includes('/ai/'),
    })
    useEffect(() => {
        if (token && id) rememberCurrentUser()
        setRecentUsers(readRecentUsers())
    }, [id, token])

    if (pathname === '/status') return null

    if (isAiWorkbench) {
        return (
            <div data-site-header className='site-chrome fixed left-0 top-0 z-1000 w-full border-b border-ui-border bg-ui-panel text-ui-text px-4 sm:px-6'>
                <SharedHeader brandHref={token ? '/dashboard' : '/login'} logoSrc='/hanasand-logo-transparent.png' links={[]} className='mx-auto h-14 w-full justify-between gap-3' actions={<div className='flex min-w-0 items-center gap-2'>
                    {token && <OrganizationSwitcher />}
                    <AccountMenu token={token} id={id} username={username} pathname={pathname} recentUsers={recentUsers} />
                </div>} />
            </div>
        )
    }

    return (
        <div data-site-header className='site-chrome fixed left-0 top-0 z-1000 w-full border-b border-ui-border bg-ui-panel text-ui-text px-3 sm:px-5 md:px-10 lg:px-16'>
            <SharedHeader brandHref={token ? '/dashboard' : '/login'} logoSrc='/hanasand-logo-transparent.png' links={[]} className='mx-auto h-18 w-full max-w-7xl justify-between gap-2 sm:gap-5' actions={
                <div className='flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2'>
                    <PublicDesktopNavigation />
                    {token && <OrganizationSwitcher />}
                    <Link href={token ? '/dashboard' : '/login'} className={`${token ? 'hidden sm:inline-flex' : 'inline-flex'} h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-canvas hover:text-ui-text sm:px-4`}>
                        <span className='sm:hidden'>Dashboard</span><span className='hidden sm:inline'>{token ? 'Dashboard' : 'Go to Dashboard'}</span>
                    </Link>
                    <SiteSearch token={token} />
                    <span className='[&_button]:w-10'><ThemeSwitch /></span>
                    <AccountMenu token={token} id={id} username={username} pathname={pathname} recentUsers={recentUsers} />
                    <PublicMobileMenu key={pathname} token={token} />
                    {mobile.enabled && <Menu />}
                </div>
            } />
            <SupportAssistant internal={isAppSurface} />
        </div>
    )
}
