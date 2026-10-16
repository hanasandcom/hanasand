import { useCallback, useMemo } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import type { WorkbenchState } from './useWorkbenchState'

export function useDeploymentActions(state: WorkbenchState, activeConversation: AIConversation | null) {
    const { isAuthenticated, setStatusNotice, setDeployPending, setDeployments, setDeployQuota, deployments, releases } = state
    const startDeployment = useCallback(async ({ vmName, port, healthPath, accessPolicy, environment }: {
        vmName: string
        port: string
        healthPath: string
        accessPolicy: AIDeploymentAccessPolicy
        environment: AIDeploymentEnvironment
    }) => {
        if (!activeConversation) {
            setStatusNotice('Open a conversation before starting a launch check.')
            return
        }
        if (!isAuthenticated) {
            setStatusNotice('Sign in to run a launch check.')
            return
        }
        const targetVmName = vmName.trim()
        if (!targetVmName) {
            setStatusNotice('Choose a launch target before starting a check.')
            return
        }
        setDeployPending(true)
        setStatusNotice('Starting remote launch check...')
        try {
            const response = await aiClientRequest('/ai/deployments', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId: activeConversation.id,
                    vmName: targetVmName,
                    port,
                    healthPath,
                    accessPolicy,
                    environment,
                }),
            })
            const payload = await response.json().catch(() => null) as {
                deployment?: AIDeployment
                quota?: AIDeployQuota
                error?: string
            } | null
            if (!response.ok && !payload?.deployment) {
                throw new Error(payload?.error || 'Unable to start launch check.')
            }
            if (payload?.deployment) {
                setDeployments((prev) => [payload.deployment!, ...prev.filter((deployment) => deployment.id !== payload.deployment!.id)])
                if (payload.quota) setDeployQuota(payload.quota)
                setStatusNotice(payload.deployment.status === 'running'
                    ? 'Launch healthcheck passed. Preview is reachable from the target.'
                    : payload.deployment.failureReason || 'Launch check requires a manual follow-up step.')
            }
        } catch (error) {
            setStatusNotice(error instanceof Error ? error.message : 'Unable to start launch check.')
        } finally {
            setDeployPending(false)
        }
    }, [activeConversation, isAuthenticated, setDeployPending, setDeployments, setDeployQuota, setStatusNotice])
    const activeDeployments = useMemo(() => activeConversation
        ? deployments.filter((deployment) => deployment.conversationId === activeConversation.id)
        : [], [activeConversation, deployments])
    const activeReleases = useMemo(() => activeConversation
        ? releases.filter((release) => release.conversationId === activeConversation.id)
        : [], [activeConversation, releases])

    return { startDeployment, activeDeployments, activeReleases }
}
