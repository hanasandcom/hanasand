import { useCallback, useEffect, useRef, useState } from 'react'
import { startVMPolling } from './pollingLifecycle'

export default function useVMConnection(vmName: string, initialConnection: VMConnectionDetails | null) {
    const [connection, setConnection] = useState(initialConnection)
    const [error, setError] = useState('')
    const refreshRef = useRef<() => void>(() => {})
    const refresh = useCallback(() => refreshRef.current(), [])

    useEffect(() => {
        let disposed = false
        setConnection(initialConnection)
        setError('')

        const lifecycle = startVMPolling(async signal => {
            const response = await fetch(`/api/backend/vm/${encodeURIComponent(vmName)}/connection`, {
                cache: 'no-store', signal,
            })
            if (response.status === 401) {
                if (!disposed) {
                    setConnection(null)
                    const path = window.location.pathname + window.location.search + window.location.hash
                    const login = '/login?' + new URLSearchParams({ path, expired: 'true' })
                    window.location.replace('/logout?' + new URLSearchParams({ path: login }))
                }
                return false
            }
            if ([403, 404].includes(response.status)) {
                if (!disposed) {
                    setConnection(null)
                    setError(response.status === 403 ? 'You do not have permission to view access details.' : 'This VM is no longer available.')
                }
                return false
            }
            if (!response.ok) throw new Error('Access details unavailable')
            const next = await response.json() as VMConnectionDetails
            if (!next || typeof next.username !== 'string' || typeof next.certificateCount !== 'number') throw new Error('Incomplete access details')
            if (!disposed) {
                setConnection(next)
                setError('')
            }
            return true
        }, { intervalMs: 30_000, maxRetryMs: 30_000, initialDelayMs: initialConnection ? 30_000 : 0, allowTerminalRefresh: true })
        refreshRef.current = lifecycle.refresh
        return () => {
            disposed = true
            lifecycle.dispose()
        }
    }, [vmName, initialConnection])

    return { connection, error, refresh }
}
