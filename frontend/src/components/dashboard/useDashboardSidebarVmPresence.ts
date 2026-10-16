import { useEffect, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'

export function useDashboardSidebarVmPresence(userId: string) {
    const [hasVMs, setHasVMs] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        let requestInFlight = false
        let refreshRequested = false
        const refresh = async () => {
            if (requestInFlight) { refreshRequested = true; return }
            requestInFlight = true
            try {
                const id = getCookie('impersonating_id') || userId
                if (id.startsWith('svc_')) { setHasVMs(false); return }
                const response = await fetch(`/api/backend/vms/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
                if (!response.ok) return
                const vms = await response.json()
                if (Array.isArray(vms) && !controller.signal.aborted) setHasVMs(vms.length > 0)
            } catch { /* Keep the last known navigation if the VM request fails. */ }
            finally {
                requestInFlight = false
                if (refreshRequested && !controller.signal.aborted) { refreshRequested = false; void refresh() }
            }
        }
        void refresh()
        window.addEventListener('vms-updated', refresh)
        return () => { controller.abort(); window.removeEventListener('vms-updated', refresh) }
    }, [userId])

    return hasVMs
}
