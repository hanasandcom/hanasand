'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import ThemeSwitch from '@/components/theme/themeSwitch'
import { hasAppSidebar } from '@/utils/routes/appRoutes'
import Menu from '@/components/menu/menu'
import Link from 'next/link'
import BrandLogo from '@/components/brand/brandLogo'
import SiteSearch from './siteSearch'
import AccountMenu from './accountMenu'
import { PublicDesktopNavigation, PublicMobileMenu } from './publicNavigation'
import { OrganizationSwitcher } from '@/components/organizations/workspaceProvider'
import SupportAssistant from '@/components/support/supportAssistant'
import { useMobileNavigation } from '@/components/layout/mobileNavigation'
import { isAppSurfacePath } from '@/components/layout/appSurface'
import { readRecentUsers, rememberCurrentUser, type RecentUser } from '@/utils/auth/savedProfiles'

export default function Header({ token, id, username, path: serverPath }: { token: boolean, id: string, username: string, path: string }) {
    const mobile = useMobileNavigation()
    const pathname = usePathname() || serverPath
    const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
    const isAppSurface = isAppSurfacePath(pathname, {
        sidebarVisible: Boolean(token && hasAppSidebar(pathname)),
        loggedInTi: token && (pathname === '/ti' || pathname.startsWith('/ti/')),
        aiPath: pathname.endsWith('/ai') || pathname.includes('/ai/'),
    })
    const pricingHref = token ? '/subscription' : '/pricing'

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
                    <AccountMenu token={token} id={id} username={username} pathname={pathname} recentUsers={recentUsers} />
                    <PublicMobileMenu key={pathname} token={token} />
                    {mobile.enabled && <Menu />}
                </div>
            </div>
            <SupportAssistant internal={isAppSurface} />
        </header>
    )
}
