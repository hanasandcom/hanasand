import { NextResponse } from 'next/server'

type CacheEntry = { payload: unknown, expiresAt: number, staleUntil: number }
type FetchResult = { payload: unknown, status: number }

const snapshots = new Map<string, CacheEntry>()
const refreshes = new Map<string, Promise<FetchResult>>()
const CACHE_TTL_MS = 10_000
const STALE_MS = 2 * 60_000
const CACHE_MAX_ENTRIES = 64

export async function serveDwmProductSnapshot(target: URL, init: RequestInit) {
    const key = target.toString()
    const cached = snapshots.get(key)
    if (cached && cached.staleUntil > Date.now()) {
        touchSnapshot(key, cached)
        if (cached.expiresAt <= Date.now()) void fetchSnapshot(key, target, init).catch(() => undefined)
        return NextResponse.json(cached.payload, { headers: { 'cache-control': 'no-store' } })
    }

    const fetched = await fetchSnapshot(key, target, init)
    return NextResponse.json(fetched.payload, { status: fetched.status, headers: { 'cache-control': 'no-store' } })
}

function touchSnapshot(key: string, entry: CacheEntry) {
    snapshots.delete(key)
    snapshots.set(key, entry)
}

async function fetchSnapshot(key: string, target: URL, init: RequestInit): Promise<FetchResult> {
    const existing = refreshes.get(key)
    if (existing) return existing

    const pending = (async () => {
        const response = await fetch(target, init)
        const text = await response.text()
        const payload = text ? JSON.parse(text) as unknown : {}
        if (response.ok) {
            const now = Date.now()
            touchSnapshot(key, { payload, expiresAt: now + CACHE_TTL_MS, staleUntil: now + STALE_MS })
            while (snapshots.size > CACHE_MAX_ENTRIES) {
                snapshots.delete(snapshots.keys().next().value!)
            }
        }
        return { payload, status: response.status }
    })()

    refreshes.set(key, pending)
    try {
        return await pending
    } finally {
        if (refreshes.get(key) === pending) refreshes.delete(key)
    }
}
