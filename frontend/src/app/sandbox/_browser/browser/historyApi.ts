import { historyApiPath } from './browserSetup'
import { ensureBrowserIdentitySession } from './browserSession'
import { runHistoryValue } from './historyData'
import type { BrowserRunHistory } from './types'

export type PagedBrowserHistoryRun = BrowserRunHistory & { resultId: string }
export type PagedBrowserHistory = { runs: PagedBrowserHistoryRun[]; nextOffset: number | null }
export type RecentBrowserHistory = { runs: unknown[]; quota: unknown }

export async function fetchPagedBrowserHistory(clientId: string, offset: number, signal: AbortSignal): Promise<PagedBrowserHistory> {
    await ensureBrowserIdentitySession()
    const query = new URLSearchParams({ history: 'all', offset: String(offset), clientId })
    const response = await fetch(`${historyApiPath}?${query}`, { credentials: 'include', signal })
    if (!response.ok) throw new Error('Could not load history.')
    return pagedHistoryValue(await response.json())
}

export async function fetchRecentBrowserHistory(clientId: string): Promise<RecentBrowserHistory> {
    await ensureBrowserIdentitySession()
    const response = await fetch(`${historyApiPath}?clientId=${encodeURIComponent(clientId)}`, {
        credentials: 'include',
        cache: 'no-store',
    })
    if (!response.ok) throw new Error('Could not refresh browser history.')
    return recentHistoryValue(await response.json())
}

export function pagedHistoryValue(value: unknown): PagedBrowserHistory {
    const record = objectValue(value)
    const runs = Array.isArray(record?.runs) ? record.runs.map(pagedRunValue).filter(isPresent) : []
    const offset = record?.nextOffset
    return { runs, nextOffset: offset === null || offset === undefined ? null : validOffset(offset) }
}

export function recentHistoryValue(value: unknown): RecentBrowserHistory {
    const record = objectValue(value)
    return {
        runs: Array.isArray(record?.runs) ? record.runs : [],
        quota: record?.quota,
    }
}

function pagedRunValue(value: unknown): PagedBrowserHistoryRun | null {
    const run = runHistoryValue(value)
    if (!run?.resultId) return null
    return { ...run, resultId: run.resultId }
}

function objectValue(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function validOffset(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function isPresent<T>(value: T | null): value is T {
    return value !== null
}
