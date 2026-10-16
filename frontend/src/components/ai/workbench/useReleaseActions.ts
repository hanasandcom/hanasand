import { useCallback } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import type { WorkbenchState } from './useWorkbenchState'

export function useReleaseActions(state: WorkbenchState) {
    const { isAuthenticated, setStatusNotice, setRollbackPendingId, setReleases } = state
    return useCallback(async (releaseId: string) => {
        if (!isAuthenticated) {
            setStatusNotice('Sign in to manage release history.')
            return
        }
        setRollbackPendingId(releaseId)
        try {
            const response = await aiClientRequest(`/ai/releases/${encodeURIComponent(releaseId)}/rollback`, {
                method: 'POST',
            })
            const payload = await response.json().catch(() => null) as { release?: AIRelease, error?: string } | null
            if (!response.ok || !payload?.release) throw new Error(payload?.error || 'Unable to mark rollback target.')
            setReleases((prev) => prev.map((release) => {
                if (release.conversationId !== payload.release!.conversationId) return release
                if (release.id === payload.release!.id) return payload.release!
                if (release.status === 'current') {
                    return { ...release, status: 'rolled_back', updatedAt: payload.release!.updatedAt }
                }
                return release
            }))
            setStatusNotice('Marked a previous release as the rollback target. Final restore still needs a manual runtime step.')
        } catch (error) {
            setStatusNotice(error instanceof Error ? error.message : 'Unable to mark rollback target.')
        } finally {
            setRollbackPendingId(null)
        }
    }, [isAuthenticated, setRollbackPendingId, setReleases, setStatusNotice])
}
