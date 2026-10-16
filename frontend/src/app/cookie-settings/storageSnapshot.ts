export type ConsentChoice = 'unset' | 'essential' | 'optional'

export type StorageSnapshot = {
    consent: ConsentChoice
    consentUpdatedAt: string
    sessionToken: boolean
    impersonationToken: boolean
    localProductKeys: string[]
    sessionProductKeys: string[]
}

export type StorageSources = {
    cookieString: string
    localStorage: Storage
    sessionStorage: Storage
}

const consentCookie = 'hanasand_cookie_consent'
const consentUpdatedCookie = 'hanasand_cookie_consent_updated_at'
const hiddenCookieNames = new Set(['id', 'name', 'theme'])
const productStoragePrefixes = [
    'hanasand.share.',
    'hanasand.share.git.',
    'hanasand.ai.',
    'hanasand:dwm-',
    'hanasand:ti-',
    'hanasand:load-testing-',
    'hanasand:share-design-memory',
    'hanasand.upload.',
]

export function emptySnapshot(): StorageSnapshot {
    return {
        consent: 'unset',
        consentUpdatedAt: '',
        sessionToken: false,
        impersonationToken: false,
        localProductKeys: [],
        sessionProductKeys: [],
    }
}

export function readSnapshot(sources: StorageSources): StorageSnapshot {
    const cookies = cookieNames(sources.cookieString)
    return {
        consent: normalizeConsent(cookieValue(sources.cookieString, consentCookie)),
        consentUpdatedAt: cookieValue(sources.cookieString, consentUpdatedCookie) || '',
        sessionToken: cookies.includes('access_token'),
        impersonationToken: cookies.includes('impersonation_token'),
        localProductKeys: productKeys(sources.localStorage),
        sessionProductKeys: productKeys(sources.sessionStorage),
    }
}

export function normalizeConsent(value: string | null): ConsentChoice {
    if (value === 'essential' || value === 'optional') return value
    return 'unset'
}

export function productKeys(storage: Storage): string[] {
    try {
        const keys: string[] = []
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index)
            if (key && productStoragePrefixes.some((prefix) => key.startsWith(prefix))) {
                keys.push(key)
            }
        }
        return keys.sort()
    } catch {
        return []
    }
}

export function clearKeys(keys: string[], storage: Storage): number {
    let cleared = 0
    for (const key of keys) {
        try {
            storage.removeItem(key)
            cleared += 1
        } catch {
            // Storage can be locked down by browser policy; keep clearing the rest.
        }
    }
    return cleared
}

export function friendlyKey(key: string): string {
    return key
        .replace(/^hanasand[.:]/, '')
        .replace(/\.v\d+(\.|$)/g, '$1')
        .replace(/[.:_-]+/g, ' ')
        .trim()
        .slice(0, 48)
}

function cookieNames(cookieString: string): string[] {
    return cookieString
        .split(';')
        .map((item) => item.split('=')[0]?.trim())
        .filter((name): name is string => Boolean(name) && !hiddenCookieNames.has(name))
}

function cookieValue(cookieString: string, name: string): string | null {
    const value = cookieString
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${name}=`))
        ?.slice(name.length + 1)
    return value === undefined ? null : decodeURIComponent(value)
}
