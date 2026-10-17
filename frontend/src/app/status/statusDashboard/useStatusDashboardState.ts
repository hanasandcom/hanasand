import { useEffect, useRef, useState } from 'react'
import { compactStatusSnapshot, isCurrentPublicCheck, retainVerifiedStatus, toPublicServiceStatus } from '@/utils/status/publicStatus'
import type { ServiceStatus } from '@/utils/status/getStatus'

const STATUS_API = process.env.NEXT_PUBLIC_STATUS_API_URL || 'https://status.hanasand.com/api/status'
const REFRESH_MS = 3000

export function useStatusDashboardState(serviceStatus: ServiceStatus, mode: 'status' | 'incidents' | 'incident', incidentId?: string) {
    const [now, setNow] = useState<number | null>(null)
    const [currentStatus, setCurrentStatus] = useState(serviceStatus)
    const [refreshError, setRefreshError] = useState(false)
    const verified = useRef<ServiceStatus | undefined>(serviceStatus.checks.some(check => check.checked_at && check.status !== 'unknown') ? serviceStatus : undefined)

    useEffect(() => {
        if (mode === 'incident') return refreshIncidentMode(serviceStatus, incidentId, setCurrentStatus)
        setNow(Date.now())
        restoreVerifiedSnapshot(setCurrentStatus, verified)
        const refresh = createStatusRefresher(mode, setCurrentStatus, setRefreshError, verified)
        const clock = window.setInterval(() => setNow(Date.now()), 1000)
        const refreshTimer = window.setInterval(refresh, REFRESH_MS)
        refresh()
        return () => { window.clearInterval(clock); window.clearInterval(refreshTimer) }
    }, [mode, incidentId, serviceStatus])

    const monitoringUnavailable = refreshError || currentStatus.monitoring === 'unavailable'
        || !currentStatus.checks.every(check => isCurrentPublicCheck(check, now || Date.now()))
    return { currentStatus, monitoringUnavailable, now }
}

function refreshIncidentMode(serviceStatus: ServiceStatus, incidentId: string | undefined, setCurrentStatus: (status: ServiceStatus) => void) {
    const initial = serviceStatus.incidents.find(item => item.id === incidentId || item.aliases?.includes(incidentId || ''))
    if (initial?.status === 'resolved') return
    let pending = false
    const controller = new AbortController()
    async function refreshIncident() {
        if (pending || document.hidden) return
        pending = true
        try {
            const response = await fetch(`${STATUS_API}?incident=${encodeURIComponent(incidentId || '')}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
            if (!response.ok) return
            const next = toPublicServiceStatus(await response.json() as ServiceStatus)
            if (!Array.isArray(next.incidents) || !next.incidents.length) return
            setCurrentStatus(next)
            if (next.incidents[0].status === 'resolved') window.clearInterval(refresh)
        } catch { /* Keep the last incident report when a refresh fails. */ }
        finally { pending = false }
    }
    const refresh = window.setInterval(refreshIncident, 30_000)
    if (!initial) void refreshIncident()
    return () => { controller.abort(); window.clearInterval(refresh) }
}

export function restoreVerifiedSnapshot(setCurrentStatus: (update: (status: ServiceStatus) => ServiceStatus) => void, verified: React.MutableRefObject<ServiceStatus | undefined>, storage?: Pick<Storage, 'getItem'>) {
    try {
        const saved = JSON.parse((storage ?? localStorage).getItem('hanasand-verified-status') || 'null') as ServiceStatus | null
        if (saved?.last_verified_at && Array.isArray(saved.checks) && Array.isArray(saved.history) && Array.isArray(saved.incidents)
            && (!verified.current || Date.parse(saved.last_verified_at) > Date.parse(verified.current.last_verified_at || ''))) {
            verified.current = saved
            setCurrentStatus(current => retainVerifiedStatus(current, saved))
        }
    } catch { /* Storage is optional, for example in private browsing. */ }
}

export function createStatusRefresher(mode: 'status' | 'incidents', setCurrentStatus: (status: ServiceStatus) => void, setRefreshError: (error: boolean) => void, verified: React.MutableRefObject<ServiceStatus | undefined>, storage?: Pick<Storage, 'setItem'>) {
    let pending = false
    return async function refreshStatus() {
        if (pending) return
        pending = true
        try {
            const response = await fetch(mode === 'incidents' ? `${STATUS_API}?history=true` : STATUS_API, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
            if (!response.ok) { setRefreshError(true); return }
            const next = toPublicServiceStatus(await response.json() as ServiceStatus)
            if (!next || !Array.isArray(next.checks) || !Array.isArray(next.history) || !Array.isArray(next.incidents)) throw new Error('Invalid status feed')
            const retained = retainVerifiedStatus(next, verified.current)
            if (retained.checks.some(check => check.checked_at && check.status !== 'unknown')) {
                verified.current = retained
                try { (storage ?? localStorage).setItem('hanasand-verified-status', JSON.stringify(compactStatusSnapshot(retained))) } catch { /* Optional persistence. */ }
            }
            setCurrentStatus(retained)
            setRefreshError(next.monitoring === 'unavailable')
        } catch { setRefreshError(true) }
        finally { pending = false }
    }
}
