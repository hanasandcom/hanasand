import type { BrowserQuota, BrowserRunHistory, ProviderRunResult } from './types'
import { historyStorageKey, normalizeTarget } from './browserSetup'
import { safeToolKey, stringValue } from './browserValues'

export function runDurationLabel(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (!remainingSeconds) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    if (!minutes) return `${remainingSeconds} seconds`
    return `${minutes} min ${remainingSeconds} sec`
}

export function runQuotaSummary(quota: BrowserQuota | null, status: 'loading' | 'ready' | 'unavailable') {
    if (status === 'loading') return 'Loading run limits'
    if (status === 'unavailable') return 'Run limits unavailable'
    if (!quota) return 'Run limits unavailable'
    const concurrency = quota.concurrentLimit === null
        ? 'no simultaneous-browser limit'
        : `${quota.concurrentLimit || 1} simultaneous browser${(quota.concurrentLimit || 1) > 1 ? 's' : ''}`
    const daily = quota.limit === null ? 'no daily run limit' : `${quota.used}/${quota.limit} runs today`
    return `${runDurationLabel(quota.sessionSeconds)} per run · ${concurrency} · ${daily}`
}

export function runHistoryValue(value: unknown): BrowserRunHistory | null {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    const id = stringValue(record.id)
    const target = stringValue(record.target)
    const runNetwork = stringValue(record.network) === 'tor' ? 'tor' : 'regular'
    const startedAt = stringValue(record.startedAt) || stringValue(record.started_at) || new Date().toISOString()
    if (!id || !target) return null
    return {
        id,
        resultId: stringValue(record.resultId),
        target,
        network: runNetwork,
        status: stringValue(record.status) || 'running',
        startedAt,
        title: stringValue(record.title),
        providerResults: providerResultsValue(record.providerResults),
        reportUrl: stringValue(record.reportUrl),
    }
}

function providerResultsValue(value: unknown): Record<string, ProviderRunResult> | undefined {
    if (!value || typeof value !== 'object') return undefined
    const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
        if (!item || typeof item !== 'object') return []
        const record = item as Record<string, unknown>
        const status = stringValue(record.status)
        if (status !== 'clean' && status !== 'suspicious' && status !== 'blocked' && status !== 'loading') return []
        return [[safeToolKey(key), { status, label: stringValue(record.label) || key }] as const]
    })
    return entries.length ? Object.fromEntries(entries) : undefined
}

export function sanitizeHistory(value: unknown): BrowserRunHistory[] {
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return (value.map(runHistoryValue).filter(Boolean) as BrowserRunHistory[])
        .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
        .filter(run => {
            const key = run.resultId || normalizeTarget(run.target)
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .slice(0, 12)
}

export function persistHistory(next: BrowserRunHistory[]) {
    const deduped = sanitizeHistory(next)
    try {
        window.localStorage.setItem(historyStorageKey, JSON.stringify(deduped))
    } catch {
        // Local history is best effort; backend history is authoritative for authenticated users.
    }
    return deduped
}

export function historyDomainKey(target: string) {
    try {
        return new URL(normalizeTarget(target)).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
        return target.trim().toLowerCase()
    }
}
