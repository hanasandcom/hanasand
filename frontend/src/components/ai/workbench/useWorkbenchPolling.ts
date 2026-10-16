import { useEffect } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import type { WorkbenchState } from './useWorkbenchState'

export function useWorkbenchPolling(state: WorkbenchState, markUnauthorized: (response: Response) => boolean) {
    const {
        isAuthenticated, aiApiAvailable, activeConversationId, refreshRuntimeRef, setRuntimeSnapshot,
        setAvailableVmTargets, setDeployments, setDeployQuota, setReleases,
    } = state
    useEffect(() => {
        refreshRuntimeRef.current = async () => {
            if (!isAuthenticated || !aiApiAvailable) return
            try {
                const response = await aiClientRequest('/ai/runtime')
                if (markUnauthorized(response) || !response.ok) return
                const payload = await response.json().catch(() => null) as { runtimeState?: AIRuntimeState } | null
                if (payload?.runtimeState) setRuntimeSnapshot(payload.runtimeState)
            } catch {
                // Runtime refresh is best effort and should not interrupt the session.
            }
        }
    }, [aiApiAvailable, isAuthenticated, markUnauthorized, refreshRuntimeRef, setRuntimeSnapshot])
    useEffect(() => {
        if (!isAuthenticated || !aiApiAvailable) return
        void refreshRuntimeRef.current()
        const interval = window.setInterval(() => void refreshRuntimeRef.current(), 10000)
        return () => window.clearInterval(interval)
    }, [aiApiAvailable, isAuthenticated, refreshRuntimeRef])
    useEffect(() => {
        if (!isAuthenticated || !aiApiAvailable) return
        let cancelled = false
        const loadTargets = async () => {
            try {
                const response = await aiClientRequest('/vms/agent/targets')
                if (markUnauthorized(response) || !response.ok) return
                const payload = await response.json().catch(() => null) as { targets?: AgentVmTarget[] } | null
                if (!cancelled) setAvailableVmTargets(Array.isArray(payload?.targets) ? payload.targets : [])
            } catch {
                // VM discovery is best effort.
            }
        }
        void loadTargets()
        return () => { cancelled = true }
    }, [aiApiAvailable, isAuthenticated, markUnauthorized, setAvailableVmTargets])
    useEffect(() => {
        if (!isAuthenticated || !aiApiAvailable || !activeConversationId) return
        let cancelled = false
        const refresh = async () => {
            try {
                const response = await aiClientRequest(`/ai/deployments?conversationId=${encodeURIComponent(activeConversationId)}`)
                if (markUnauthorized(response) || !response.ok) return
                const payload = await response.json().catch(() => null) as { deployments?: AIDeployment[], quota?: AIDeployQuota } | null
                if (!cancelled && Array.isArray(payload?.deployments)) {
                    setDeployments((prev) => [
                        ...payload.deployments!,
                        ...prev.filter((deployment) => deployment.conversationId !== activeConversationId),
                    ])
                    if (payload.quota) setDeployQuota(payload.quota)
                }
            } catch {
                // Deployment history is a resume aid; polling should not interrupt chat.
            }
        }
        void refresh()
        const interval = window.setInterval(refresh, 15000)
        return () => { cancelled = true; window.clearInterval(interval) }
    }, [activeConversationId, aiApiAvailable, isAuthenticated, markUnauthorized, setDeployments, setDeployQuota])
    useEffect(() => {
        if (!isAuthenticated || !aiApiAvailable || !activeConversationId) return
        let cancelled = false
        const refresh = async () => {
            try {
                const response = await aiClientRequest(`/ai/releases?conversationId=${encodeURIComponent(activeConversationId)}`)
                if (markUnauthorized(response) || !response.ok) return
                const payload = await response.json().catch(() => null) as { releases?: AIRelease[] } | null
                if (!cancelled && Array.isArray(payload?.releases)) setReleases(payload.releases)
            } catch {
                // Release history is informative; polling should not interrupt chat.
            }
        }
        void refresh()
        const interval = window.setInterval(refresh, 15000)
        return () => { cancelled = true; window.clearInterval(interval) }
    }, [activeConversationId, aiApiAvailable, isAuthenticated, markUnauthorized, setReleases])
}
