import { useSyncExternalStore } from 'react'
import { getDashboardNavigation, navigationLinks, type NavigationAccess, type NavigationItem } from '@/utils/layout/dashboardNavigation'
import { getThesisNavigation, subscribeThesisNavigation } from '@/utils/layout/thesisNavigation'
import { canManageHanasandOrganizations, canViewHanasandInternalPages } from '@/utils/organizations/internalPageAccess'

type OrganizationAccess = Array<{ id: string; name?: string; slug?: string; role?: string; lifecycleStatus?: string }>

export function useDashboardSidebarNavigation({
    access,
    organizations,
    organizationId,
    hasVMs,
    initialThesisSheets,
    pathname,
    searchParams,
}: {
    access: NavigationAccess
    organizations: OrganizationAccess
    organizationId: string
    hasVMs: boolean
    initialThesisSheets: ReturnType<typeof getThesisNavigation>
    pathname: string
    searchParams: URLSearchParams
}) {
    const thesisSheets = useSyncExternalStore(subscribeThesisNavigation, () => {
        const current = getThesisNavigation()
        return current.length ? current : initialThesisSheets
    }, () => initialThesisSheets)
    const hasHanasandOrganization = access.hasHanasandOrganization === true || organizations.some(
        organization => organization.slug?.toLowerCase() === 'hanasand' && organization.lifecycleStatus === 'active',
    )
    const canViewInternalPages = access.canViewInternalPages === true || canViewHanasandInternalPages(organizations)
    const canManageOrganizations = access.canManageOrganizations === true || canManageHanasandOrganizations(organizations)
    const sections = getDashboardNavigation({
        ...access,
        canViewInternalPages,
        canManageOrganizations,
        canReviewIntel: access.canReviewIntel || canViewInternalPages,
        hasVMs: hasVMs || canViewInternalPages,
        hasContentOrganization: Boolean(organizationId),
        hasHanasandOrganization,
        thesisSheets,
    })
    const links = navigationLinks(sections)
    const matchesHref = (href: string) => {
        const [hrefPath, hrefQuery = ''] = href.split('?')
        if (pathname !== hrefPath && !pathname.startsWith(`${hrefPath}/`)) return false
        return [...new URLSearchParams(hrefQuery)].every(([key, value]) => searchParams.get(key) === value)
    }
    const active = links.filter(item => matchesHref(item.href))
        .sort((left, right) => right.href.length - left.href.length)[0]
        ?? (pathname === '/thesis' ? links.find(item => item.href.startsWith('/thesis?sheet=')) : undefined)
    const activePath = (active?.ancestors.length ? active.ancestors.join('/') : active?.label)
        ?? (pathname.startsWith('/automation') ? 'Automation' : '')

    return { sections, links, active, activePath, canViewInternalPages }
}

export type SidebarActiveItem = ReturnType<typeof navigationLinks>[number] | undefined
export type { NavigationItem }
