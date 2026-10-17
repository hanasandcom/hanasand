export type ScenarioId = 'baseline' | 'ramp' | 'spike'

export type Scenario = {
    id: ScenarioId
    label: string
    detail: string
    stages: Array<{ duration: string, target: number }>
    timeout: number
}

export const scenarioPresets: Scenario[] = [
    {
        id: 'baseline',
        label: 'Baseline',
        detail: 'One-user release check',
        stages: [{ duration: '30s', target: 1 }],
        timeout: 30000,
    },
    {
        id: 'ramp',
        label: 'Ramp',
        detail: 'Capacity smoke test',
        stages: [{ duration: '30s', target: 5 }, { duration: '1m', target: 20 }, { duration: '30s', target: 0 }],
        timeout: 45000,
    },
    {
        id: 'spike',
        label: 'Spike',
        detail: 'Burst and recovery check',
        stages: [{ duration: '15s', target: 5 }, { duration: '20s', target: 40 }, { duration: '25s', target: 0 }],
        timeout: 60000,
    },
]

export function isValidServiceUrl(value: string) {
    try {
        const url = new URL(value.trim())
        return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname.includes('.'))
    } catch {
        return false
    }
}

export function dedupeScans(scans: Test[]) {
    const seen = new Set<string>()
    return scans
        .filter((scan) => {
            if (seen.has(scan.id)) return false
            seen.add(scan.id)
            return true
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function loadTestStatusCounts(scans: Test[]) {
    return scans.reduce((counts, scan) => {
        const status = scan.status.toLowerCase()
        if (status === 'queued') counts.queued++
        if (status === 'running') counts.running++
        if (status === 'failed' || status === 'error') counts.failed++
        return counts
    }, { queued: 0, running: 0, failed: 0 })
}

export function latestP95(scan?: Test) {
    const value = scan?.latest_run_summary?.duration?.p95 ?? scan?.summary?.duration?.p95
    return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}
