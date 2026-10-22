'use client'

import { hasAppSidebar } from '@/utils/routes/appRoutes'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Footer from '@/components/footer/footer'
import { useMobileNavigation } from './mobileNavigation'
import { isAppSurfacePath } from './appSurface'
import isSharePath from '@/utils/routes/isSharePath'

export default function RouteFrame({ children, serverPath, token, sidebar, banner }: { children: ReactNode, serverPath: string, token: boolean, sidebar: ReactNode, banner: ReactNode }) {
    const mobile = useMobileNavigation()
    const pathname = usePathname() || serverPath
    const isShare = isSharePath(pathname)
    const showSidebar = Boolean(sidebar) && hasAppSidebar(pathname)
    const isAiWorkbench = pathname.startsWith('/ai') && pathname !== '/ai/window'
    const isThesisPage = pathname === '/thesis' || pathname.startsWith('/thesis/') || pathname === '/content/thesis' || pathname.startsWith('/content/thesis/')
    const isLoggedInTi = token && (pathname === '/ti' || pathname.startsWith('/ti/'))
    const isAppSurface = isAppSurfacePath(pathname, {
        sidebarVisible: showSidebar,
        loggedInTi: isLoggedInTi,
        aiPath: pathname.startsWith('/ai'),
    })
    const showFooter = !isAiWorkbench && !isThesisPage && !isAppSurface
    const thesisScroll = isThesisPage && !showSidebar
    const frameRows = thesisScroll ? 'grid-rows-[auto_minmax(0,1fr)]' : showFooter ? 'grid-rows-[auto_minmax(max-content,auto)_auto]' : 'grid-rows-[auto_minmax(0,1fr)]'
    const frameOverflow = isThesisPage || isAiWorkbench || isShare || showSidebar ? 'overflow-hidden overscroll-none' : 'overflow-auto'

    return (
        <div data-route-frame className={`enterprise-theme relative z-10 ${isAiWorkbench ? 'mt-14 h-[calc(100dvh-3.5rem)]' : 'mt-18 h-[calc(100dvh-4.5rem)]'} w-full bg-ui-canvas grid grid-cols-[minmax(0,1fr)] ${frameRows} ${frameOverflow}`}>
            <div className='min-w-0'>{banner}</div>
            <main className={`${showFooter && !thesisScroll ? 'min-h-max' : 'min-h-0'} min-w-0 w-full ${isAppSurface || isAiWorkbench || thesisScroll ? 'h-full' : 'pt-3 md:pt-0'} ${thesisScroll ? 'overflow-y-auto overscroll-contain' : ''}`}>
                {showSidebar ? (
                    <div className='h-full min-h-0 bg-ui-canvas px-2 text-ui-text'>
                        <div className='grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-2 lg:grid-cols-[auto_minmax(0,1fr)]'>
                            {mobile.open && <button type='button' aria-label='Close navigation backdrop' onClick={mobile.close}
                                className='fixed inset-x-0 bottom-0 top-18 z-100 bg-ui-scrim lg:hidden' />}
                            <div id='mobile-navigation' onClick={event => {
                                if ((event.target as HTMLElement).closest('a[href]')) mobile.close()
                            }} className={`${mobile.open ? 'block' : 'hidden'} fixed inset-x-2 top-20 z-101 max-h-[calc(100dvh-5.5rem)] overflow-y-auto lg:contents`}>
                                {sidebar}
                            </div>
                            <div className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain`}>{children}</div>
                        </div>
                    </div>
                ) : children}
            </main>
            {showFooter && !thesisScroll ? <Footer /> : null}
        </div>
    )
}
