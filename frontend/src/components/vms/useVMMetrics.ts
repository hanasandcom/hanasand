import { useCallback, useEffect, useRef, useState } from 'react'
import { startVMPolling } from './pollingLifecycle'

export default function useVMMetrics(vmName: string, initialMetrics: VMMetrics[]) {
    const [metrics, setMetrics] = useState(initialMetrics)
    const [error, setError] = useState('')
    const refreshRef = useRef<() => void>(() => {})
    const refresh = useCallback(() => refreshRef.current(), [])

    useEffect(() => {
        let disposed = false
        setMetrics(initialMetrics)
        setError('')

        const lifecycle = startVMPolling(async signal => {
            const response = await fetch(`/api/backend/vm/metrics/${encodeURIComponent(vmName)}`, {
                cache: 'no-store', signal,
            })
            if ([401, 403, 404].includes(response.status)) {
                if (!disposed) {
                    setMetrics([])
                    setError(response.status === 401 ? 'Your session has expired. Sign in to view metrics.'
                        : response.status === 403 ? 'You do not have permission to view metrics.' : 'This VM is no longer available.')
                }
                return false
            }
            if (!response.ok) throw new Error('Metrics unavailable')
            const next = await response.json() as VMMetrics[]
            if (!Array.isArray(next) || !next.length || next.some(sample => sample.name !== vmName || !Number.isFinite(Date.parse(sample.created_at)))) throw new Error('Incomplete metrics')
            if (!disposed) {
                setMetrics(next)
                setError('')
            }
            return true
        }, { intervalMs: 10_000, maxRetryMs: 10_000 })
        refreshRef.current = lifecycle.refresh
        return () => {
            disposed = true
            lifecycle.dispose()
        }
    }, [vmName, initialMetrics])

    return { metrics, error, refresh }
}
