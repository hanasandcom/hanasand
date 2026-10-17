import type { TrafficMetrics, TrafficRecords } from '@/utils/monitoring/types'

export type TrafficSnapshot = {
    metrics?: TrafficMetrics | null
    records?: TrafficRecords | null
}

export function startTrafficSnapshotRefresh(
    selectedDomain: string | undefined,
    onSnapshot: (snapshot: TrafficSnapshot) => void,
    recordLimit?: number,
) {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function refresh() {
        try {
            const params = new URLSearchParams({
                mode: 'snapshot',
                ...(recordLimit ? { limit: String(recordLimit) } : {}),
                ...(selectedDomain ? { domain: selectedDomain } : {}),
            })
            const response = await fetch(`/api/live-traffic?${params}`, { cache: 'no-store' })
            if (!response.ok) throw new Error(`Traffic request returned ${response.status}`)
            const snapshot = await response.json() as TrafficSnapshot
            if (!stopped) onSnapshot(snapshot)
        } catch {
            // Keep the last successful traffic snapshot visible until a later refresh succeeds.
        } finally {
            if (!stopped) timer = setTimeout(refresh, 30_000)
        }
    }

    timer = setTimeout(refresh, 30_000)
    return () => {
        stopped = true
        if (timer) clearTimeout(timer)
    }
}
