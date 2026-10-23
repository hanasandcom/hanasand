export type BrowserRunHistory = {
    resultId?: string
    id: string
    target: string
    network: BrowserNetwork
    status: string
    startedAt: string
    checkCount?: number
    title?: string
    providerResults?: Record<string, ProviderRunResult>
    reportUrl?: string
}
export type ProviderRunResult = {
    status: 'clean' | 'suspicious' | 'blocked' | 'loading'
    label: string
}
export type BrowserQuota = {
    plan: string
    limit: number | null
    used: number
    remaining: number | null
    paid: boolean
    advancedAnalysis: boolean
    sessionSeconds: number
    concurrentLimit: number | null
    active: number
    resetsAt?: string | null
    identityKind?: string
}
export type BrowserRunStats = {
    runs24h: number
    darkwebRuns24h: number
}
export type BrowserInitialData = {
    history: BrowserRunHistory[]
    quota: BrowserQuota | null
    stats: BrowserRunStats | null
}
import type { BrowserNetwork } from './session'
