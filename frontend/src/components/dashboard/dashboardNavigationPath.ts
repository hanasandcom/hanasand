export function isActiveDashboardNavigationPath(activePath: string, path: string) {
    return activePath === path || activePath.startsWith(`${path}/`)
}
