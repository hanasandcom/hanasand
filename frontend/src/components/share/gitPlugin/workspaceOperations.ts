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
        return runGitOperation(context, {
            pending: 'status',
            signedOutMessage: 'Sign in to inspect Git changes.',
            startingMessage: 'Checking Git changes...',
            fallbackError: 'Failed to load Git status.',
            action: () => getRepositoryGitStatus(repositoryId, context.share?.id || context.shareRouteId),
            onSuccess: nextStatus => {
                const { shareRouteId, setGitStatus, setSelectedPaths, stored, autoPullMinutes, setStored } = context
                setGitStatus(nextStatus)
                setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
                if (stored) {
                    const nextStored = { ...stored, updatedAt: new Date().toISOString(), autoPullMinutes }
                    rememberGitWorkspace(shareRouteId, nextStored)
                    setStored(nextStored)
                }
                context.setStatus(nextStatus.files.length ? `${nextStatus.files.length} changed file${nextStatus.files.length === 1 ? '' : 's'} ready to stage.` : 'No Git changes in the editor.')
            },
        })
    }

    const pullGitWorkspace = async () => {
        return runGitOperation(context, {
            pending: 'pull',
            signedOutMessage: 'Sign in to pull Git changes.',
            startingMessage: 'Pulling the cached Git worktree...',
            fallbackError: 'Failed to pull Git worktree.',
            action: () => pullRepositoryWorkspace(context.shareRouteId),
            onSuccess: nextStatus => {
                const { shareRouteId, setGitStatus, setSelectedPaths, stored, autoPullMinutes, setStored } = context
                setGitStatus(nextStatus)
                setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
                if (stored) updateSyncTime(shareRouteId, stored, autoPullMinutes, setStored)
                context.setStatus('Remote changes pulled into the Git worktree.')
            },
        })
    }

    const commitSelectedFiles = async () => {
        let paths: string[] = []
        return runGitOperation(context, {
            pending: 'commit',
            signedOutMessage: 'Sign in to commit Git changes.',
            startingMessage: () => {
                paths = [...context.selectedPaths]
                return `Committing ${paths.length} staged file${paths.length === 1 ? '' : 's'}...`
            },
            fallbackError: 'Failed to commit staged files.',
            action: () => commitRepositoryWorkspace(context.shareRouteId, context.share?.id || context.shareRouteId, context.commitMessage, paths),
            onSuccess: result => {
                const { setGitStatus, setSelectedPaths, setCommitMessage } = context
                setGitStatus(result.status)
                setSelectedPaths(new Set(result.status.files.map(file => file.path)))
                setCommitMessage('')
                context.setStatus(`Committed ${result.commit}.`)
            },
        })
    }

    const pushGitWorkspace = async () => {
        return runGitOperation(context, {
            pending: 'push',
            signedOutMessage: 'Sign in to push Git changes.',
            startingMessage: 'Pushing commits...',
            fallbackError: 'Failed to push repository.',
            action: () => pushRepositoryWorkspace(context.shareRouteId),
            onSuccess: nextStatus => {
                const { shareRouteId, setGitStatus, setSelectedPaths, stored, autoPullMinutes, setStored } = context
                setGitStatus(nextStatus)
                setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
                if (stored) updateSyncTime(shareRouteId, stored, autoPullMinutes, setStored)
                context.setStatus('Pushed to the remote repository.')
            },
        })
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

type GitOperation = Exclude<Parameters<GitOperationContext['setPending']>[0], null>

async function runGitOperation<T>(context: GitOperationContext, operation: {
    pending: GitOperation
    signedOutMessage: string
    startingMessage: string | (() => string)
    fallbackError: string
    action: () => Promise<T>
    onSuccess(value: T): void
}) {
    if (!context.isSignedIn) {
        context.setError(operation.signedOutMessage)
        return
    }

    const startingMessage = typeof operation.startingMessage === 'function'
        ? operation.startingMessage()
        : operation.startingMessage
    context.setPending(operation.pending)
    context.setError(null)
    context.setStatus(startingMessage)
    try {
        operation.onSuccess(await operation.action())
    } catch (caught) {
        context.setError(caught instanceof Error ? caught.message : operation.fallbackError)
        context.setStatus(null)
    } finally {
        context.setPending(null)
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
