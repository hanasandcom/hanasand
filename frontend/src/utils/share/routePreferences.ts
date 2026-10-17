type PreferenceCookieStore = {
    get: (name: string) => { value: string } | undefined
}

type ShareRouteName = 'project' | 'share'

export function readShareRoutePreferences(cookies: PreferenceCookieStore, routeName: ShareRouteName) {
    return {
        openFolders: parseCookieJson<string[]>(cookies.get('openFolders')?.value, [], routeName),
        openFiles: parseCookieJson<OpenFile[]>(cookies.get('openFiles')?.value, [], routeName),
        sharePageWidth: Number(cookies.get('sharePageWidth')?.value) || 0,
        shareTerminalHeight: Number(cookies.get('shareTerminalHeight')?.value) || 0,
    }
}

function parseCookieJson<T>(value: string | undefined, fallback: T, routeName: ShareRouteName): T {
    if (!value) return fallback

    try {
        return JSON.parse(value) as T
    } catch (error) {
        console.warn(`Failed to parse ${routeName} route cookie JSON: ${error}`)
        return fallback
    }
}
