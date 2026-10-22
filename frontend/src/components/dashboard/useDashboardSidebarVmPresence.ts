import { useEffect, useState } from 'react'
import { getCookie } from 'hanasand/cookies'
import { createQueuedRefresh } from './queuedRefresh'

export function useDashboardSidebarVmPresence(userId: string) {
    const [hasVMs, setHasVMs] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        const refresh = createQueuedRefresh(async () => {
            try {
                const id = getCookie('impersonating_id') || userId
                if (id.startsWith('svc_')) { setHasVMs(false); return }
                const response = await fetch(`/api/backend/vms/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
                if (!response.ok) return
                const vms = await response.json()
                if (Array.isArray(vms) && !controller.signal.aborted) setHasVMs(vms.length > 0)
            } catch { /* Keep the last known navigation if the VM request fails. */ }
        }, () => controller.signal.aborted)
        void refresh()
        window.addEventListener('vms-updated', refresh)
        return () => { controller.abort(); window.removeEventListener('vms-updated', refresh) }
    }, [userId])

    return hasVMs
}
