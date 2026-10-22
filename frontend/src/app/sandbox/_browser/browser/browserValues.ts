import type { BrowserNetwork, BrowserQuota, SandboxCapacity, SandboxEvidence, SandboxNetworkSummary, SandboxToolAnalysis, SandboxWebCrackLoad, FrameQuality } from './types'

export function parsePayload(value: string) {
    try {
        return JSON.parse(value) as Record<string, unknown>
    } catch {
        return null
    }
}

export function stringValue(value: unknown) {
    return typeof value === 'string' ? value : ''
}

export function evidenceValue(value: unknown): SandboxEvidence | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as SandboxEvidence
}

export function toolAnalysisValue(value: unknown): SandboxToolAnalysis | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as SandboxToolAnalysis
}

export function networkSummaryValue(value: unknown): SandboxNetworkSummary | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as SandboxNetworkSummary
}

export function webcrackLoadValue(value: unknown): SandboxWebCrackLoad | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as SandboxWebCrackLoad
}

export function frameQualityValue(value: unknown): FrameQuality | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as FrameQuality
}

export function capacityValue(value: unknown): SandboxCapacity | null {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    const activeSessions = finiteNumber(record.activeSessions)
    const queuedSessions = finiteNumber(record.queuedSessions)
    const maxSessions = finiteNumber(record.maxSessions)
    if (activeSessions === null || queuedSessions === null || maxSessions === null) return null
    const queuePosition = finiteNumber(record.queuePosition)
    return {
        activeSessions,
        queuedSessions,
        maxSessions,
        queuePosition: queuePosition === null ? undefined : queuePosition,
    }
}

export function quotaValue(value: unknown): BrowserQuota | null {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    const limit = finiteNumber(record.limit)
    const used = finiteNumber(record.used)
    const remaining = finiteNumber(record.remaining)
    if (used === null) return null
    return {
        plan: stringValue(record.plan) || 'anonymous',
        paid: record.paid === true,
        advancedAnalysis: record.advancedAnalysis === true,
        sessionSeconds: finiteNumber(record.sessionSeconds) || 90,
        concurrentLimit: record.concurrentLimit === null ? null : finiteNumber(record.concurrentLimit) ?? 1,
        active: finiteNumber(record.active) || 0,
        limit,
        used,
        remaining,
        resetsAt: stringValue(record.resetsAt) || null,
        identityKind: stringValue(record.identityKind) || 'anonymous',
    }
}

export function safeToolKey(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function inferNetwork(target: string): BrowserNetwork {
    try {
        return new URL(target).hostname.toLowerCase().replace(/\.$/, '').endsWith('.onion') ? 'tor' : 'regular'
    } catch {
        return 'regular'
    }
}

export function finiteNumber(value: unknown) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null
    return Math.max(0, Math.round(numeric))
}

export function clampUiNumber(value: unknown, min: number, max: number, fallback: number) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return fallback
    return Math.max(min, Math.min(max, Math.round(numeric)))
}

export function queueCopy(capacity: SandboxCapacity | null) {
    if (!capacity?.queuePosition) return 'All browser slots are busy. This run will start automatically when a slot is released.'
    return `All ${capacity.maxSessions} browser slots are busy. This run is position ${capacity.queuePosition} of ${capacity.queuedSessions} and will start automatically.`
}
