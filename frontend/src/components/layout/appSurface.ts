import { isInternalAppPath } from '@/utils/routes/appRoutes'
import isPublicProductPath from '@/utils/routes/isPublicProductPath'
import isSharePath from '@/utils/routes/isSharePath'

type AppSurfaceOptions = {
    sidebarVisible: boolean
    loggedInTi: boolean
    aiPath: boolean
}

export function isAppSurfacePath(pathname: string, options: AppSurfaceOptions) {
    const isWorkspacePath = pathname.startsWith('/profile') || pathname.startsWith('/organizations')

    return options.sidebarVisible
        || isInternalAppPath(pathname)
        || pathname === '/switch-account'
        || options.loggedInTi
        || (!isPublicProductPath(pathname) && (
            isSharePath(pathname)
            || options.aiPath
            || isWorkspacePath
        ))
}
