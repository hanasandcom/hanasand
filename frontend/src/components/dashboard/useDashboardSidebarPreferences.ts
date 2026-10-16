import { useCallback, useEffect, useState } from 'react'
import { getCookie, setCookie } from '@/utils/cookies/cookies'
import { NAVIGATION_COOKIE, readNavigationPreferences, type NavigationPreferences } from '@/utils/layout/navigationPreferences'
import { navigationLinks, pinnedNavigation, type NavigationItem } from '@/utils/layout/dashboardNavigation'

export function useDashboardSidebarPreferences({ userId, storageKey, pathname, activePath, initialPreferences, sections, links }: {
    userId: string
    storageKey: string
    pathname: string
    activePath: string
    initialPreferences: NavigationPreferences
    sections: NavigationItem[]
    links: ReturnType<typeof navigationLinks>
}) {
    const [preferences, setPreferences] = useState(initialPreferences)
    const favorites = links.filter(item => preferences.pinned.includes(item.href))
        .sort((left, right) => preferences.pinned.indexOf(left.href) - preferences.pinned.indexOf(right.href))

    const save = useCallback((next: NavigationPreferences) => {
        setPreferences(next)
        try {
            setCookie(NAVIGATION_COOKIE, JSON.stringify({ ...next, id: userId }), 365)
            localStorage.removeItem(storageKey)
        } catch { /* Keep this session usable without storage. */ }
    }, [storageKey, userId])

    useEffect(() => {
        let saved = readNavigationPreferences(getCookie(NAVIGATION_COOKIE) || undefined, userId)
        try {
            if (!getCookie(NAVIGATION_COOKIE)) {
                const legacy = JSON.parse(localStorage.getItem(storageKey) || '{}')
                saved = readNavigationPreferences(JSON.stringify({ ...legacy, id: userId }), userId)
            }
        } catch { /* Preferences are optional. */ }
        save(saved)
    }, [storageKey, pathname, activePath, save, userId])

    function isExpanded(key: string) {
        return activePath === key || activePath.startsWith(`${key}/`) || preferences.expanded[key] === true
    }

    function toggle(key: string) {
        save({ ...preferences, expanded: { ...preferences.expanded, [key]: !isExpanded(key) } })
    }

    function collapseAll() {
        const keys = [
            ...Object.keys(preferences.expanded),
            'Pinned',
            ...navigationLinks([...sections, { label: 'Pinned', items: pinnedNavigation(favorites) }])
                .flatMap(item => item.ancestors.map((_, index) => item.ancestors.slice(0, index + 1).join('/'))),
        ]
        save({ ...preferences, expanded: Object.fromEntries(keys.map(key => [key, false])) })
    }

    function pin(href: string) {
        save({
            ...preferences,
            expanded: { ...preferences.expanded, Pinned: true },
            pinned: preferences.pinned.includes(href)
                ? preferences.pinned.filter(item => item !== href)
                : [...preferences.pinned, href],
        })
    }

    return { preferences, favorites, save, isExpanded, toggle, collapseAll, pin }
}
