import {
    commitRepositoryWorkspace,
    getRepositoryGitStatus,
    pullRepositoryWorkspace,
    pushRepositoryWorkspace,
} from '@/components/ai/github'
import { rememberGitWorkspace } from './storage'
import type { GitOperationContext } from './operationContext'

export function createWorkspaceOperations(context: GitOperationContext) {
    const loadGitStatus = async (repositoryId = context.shareRouteId) => {
        const { isSignedIn, setError, setPending, setStatus, share, shareRouteId, setGitStatus, setSelectedPaths, stored, autoPullMinutes, setStored } = context
        if (!isSignedIn) {
            setError('Sign in to inspect Git changes.')
            return
        }
        setPending('status')
        setError(null)
        setStatus('Checking Git changes...')
        try {
            const nextStatus = await getRepositoryGitStatus(repositoryId, share?.id || shareRouteId)
            setGitStatus(nextStatus)
            setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
            if (stored) {
                const nextStored = { ...stored, updatedAt: new Date().toISOString(), autoPullMinutes }
                rememberGitWorkspace(shareRouteId, nextStored)
                setStored(nextStored)
            }
            setStatus(nextStatus.files.length ? `${nextStatus.files.length} changed file${nextStatus.files.length === 1 ? '' : 's'} ready to stage.` : 'No Git changes in the editor.')
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to load Git status.')
            setStatus(null)
        } finally {
            setPending(null)
        }
    }

    const pullGitWorkspace = async () => {
        const { isSignedIn, setError, setPending, setStatus, shareRouteId, setGitStatus, setSelectedPaths, stored, autoPullMinutes, setStored } = context
        if (!isSignedIn) {
            setError('Sign in to pull Git changes.')
            return
        }
        setPending('pull')
        setError(null)
        setStatus('Pulling the cached Git worktree...')
        try {
            const nextStatus = await pullRepositoryWorkspace(shareRouteId)
            setGitStatus(nextStatus)
            setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
            if (stored) updateSyncTime(shareRouteId, stored, autoPullMinutes, setStored)
            setStatus('Remote changes pulled into the Git worktree.')
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to pull Git worktree.')
            setStatus(null)
        } finally {
            setPending(null)
        }
    }

    const commitSelectedFiles = async () => {
        const { isSignedIn, selectedPaths, setError, setPending, setStatus, shareRouteId, share, commitMessage, setGitStatus, setSelectedPaths, setCommitMessage } = context
        if (!isSignedIn) {
            setError('Sign in to commit Git changes.')
            return
        }
        const paths = [...selectedPaths]
        setPending('commit')
        setError(null)
        setStatus(`Committing ${paths.length} staged file${paths.length === 1 ? '' : 's'}...`)
        try {
            const result = await commitRepositoryWorkspace(shareRouteId, share?.id || shareRouteId, commitMessage, paths)
            setGitStatus(result.status)
            setSelectedPaths(new Set(result.status.files.map(file => file.path)))
            setCommitMessage('')
            setStatus(`Committed ${result.commit}.`)
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to commit staged files.')
            setStatus(null)
        } finally {
            setPending(null)
        }
    }

    const pushGitWorkspace = async () => {
        const { isSignedIn, setError, setPending, setStatus, shareRouteId, setGitStatus, setSelectedPaths, stored, autoPullMinutes, setStored } = context
        if (!isSignedIn) {
            setError('Sign in to push Git changes.')
            return
        }
        setPending('push')
        setError(null)
        setStatus('Pushing commits...')
        try {
            const nextStatus = await pushRepositoryWorkspace(shareRouteId)
            setGitStatus(nextStatus)
            setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
            if (stored) updateSyncTime(shareRouteId, stored, autoPullMinutes, setStored)
            setStatus('Pushed to the remote repository.')
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to push repository.')
            setStatus(null)
        } finally {
            setPending(null)
        }
    }

    return {
        loadGitStatus,
        pullGitWorkspace,
        commitSelectedFiles,
        pushGitWorkspace,
        togglePath(path: string) {
            context.setSelectedPaths(previous => {
                const next = new Set(previous)
                if (next.has(path)) next.delete(path)
                else next.add(path)
                return next
            })
        },
        stageAll() {
            context.setSelectedPaths(new Set((context.gitStatus?.files || []).map(file => file.path)))
        },
    }
}

function updateSyncTime(
    shareRouteId: string,
    stored: NonNullable<GitOperationContext['stored']>,
    autoPullMinutes: number,
    setStored: GitOperationContext['setStored'],
) {
    const timestamp = new Date().toISOString()
    const nextStored = { ...stored, updatedAt: timestamp, lastSyncedAt: timestamp, autoPullMinutes }
    rememberGitWorkspace(shareRouteId, nextStored)
    setStored(nextStored)
}
