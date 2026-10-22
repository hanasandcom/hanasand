import { clientIdStorageKey } from './browserSetup'

export function getOrCreateBrowserClientId() {
    try {
        const cookie = document.cookie.split('; ').find(value => value.startsWith(`${clientIdStorageKey}=`))?.slice(clientIdStorageKey.length + 1)
        let existing = cookie ? decodeURIComponent(cookie) : ''
        if (!existing) { try { existing = window.localStorage.getItem(clientIdStorageKey) || '' } catch { /* Cookies remain available when local storage is blocked. */ } }
        if (existing) {
            persistBrowserClientCookie(existing)
            try { window.localStorage.removeItem(clientIdStorageKey) } catch { /* One-time migration is optional. */ }
            return existing
        }
        const next = crypto.randomUUID()
        persistBrowserClientCookie(next)
        return next
    } catch {
        return 'browser-storage-unavailable'
    }
}

function persistBrowserClientCookie(value: string) {
    document.cookie = `hanasand:browser:client-id:v1=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
}
