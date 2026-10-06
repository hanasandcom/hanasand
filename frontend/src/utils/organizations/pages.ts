export const organizationPages = [
    { id: 'overview', label: 'Overview', href: '/organizations' },
    { id: 'settings', label: 'Settings', href: '/organizations/settings' },
    { id: 'team', label: 'Team', href: '/organizations/team' },
    { id: 'watchlists', label: 'Watchlists', href: '/organizations/watchlists' },
    { id: 'api-keys', label: 'API keys', href: '/organizations/api-keys' },
    { id: 'privacy', label: 'Privacy & retention', href: '/organizations/privacy' },
    { id: 'events', label: 'Events & cases', href: '/organizations/events' },
    { id: 'activity', label: 'Activity', href: '/organizations/activity' },
] as const
export const organizationNavigationPages = organizationPages
export type OrganizationPage = typeof organizationPages[number]['id']
export function organizationPageForFocus(focus: string): OrganizationPage {
    if (/^(members?|invites?|team)$/.test(focus)) return 'team'
    if (focus.startsWith('watchlist')) return 'watchlists'
    if (focus.startsWith('destination') || focus.startsWith('delivery')) return 'activity'
    if (/^(alerts?|events?|cases?|scope)$/.test(focus)) return 'events'
    if (focus === 'audit') return 'activity'
    return organizationPages.find(page => page.id === focus)?.id || 'overview'
}
