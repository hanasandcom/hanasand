const CACHE_TTL_MS = 5_000
const MAX_CACHE_ENTRIES = 256
const MAX_CACHE_BYTES = 8 * 1024 * 1024
const MAX_ENTRY_BYTES = 512 * 1024

type Entry = { expiresAt: number; value?: unknown; pending?: Promise<unknown>; bytes: number }
const entries = new Map<string, Entry>()
let cacheBytes = 0

function remove(key: string) {
    const entry = entries.get(key)
    if (!entry) return
    cacheBytes -= entry.bytes
    entries.delete(key)
}

/** Short-lived process-local cache for support reads. Callers must authorize before reading it. */
export async function cachedSupportRead<T>(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const existing = entries.get(key)
    if (existing && existing.expiresAt > now) {
        if (existing.pending) return existing.pending as Promise<T>
        entries.delete(key)
        entries.set(key, existing)
        return existing.value as T
    }
    if (existing) remove(key)

    const entry: Entry = { expiresAt: now + CACHE_TTL_MS, bytes: 0 }
    const pending = load().then(value => {
        if (entries.get(key) === entry) {
            entry.pending = undefined
            const bytes = Buffer.byteLength(JSON.stringify(value) ?? '')
            if (bytes > MAX_ENTRY_BYTES) remove(key)
            else {
                entry.value = value
                entry.bytes = bytes
                entry.expiresAt = Date.now() + CACHE_TTL_MS
                cacheBytes += bytes
                while (entries.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) remove(entries.keys().next().value!)
            }
        }
        return value
    }).catch(error => {
        if (entries.get(key) === entry) remove(key)
        throw error
    })
    entry.pending = pending
    entries.set(key, entry)
    while (entries.size > MAX_CACHE_ENTRIES) entries.delete(entries.keys().next().value!)
    return pending
}

export function clearSupportReadCache() {
    entries.clear()
    cacheBytes = 0
}
