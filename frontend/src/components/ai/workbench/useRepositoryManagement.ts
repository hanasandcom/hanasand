import { useCallback } from 'react'
import { getCookie } from 'hanasand/cookies'
import { aiClientRequest } from '@/utils/ai/client'
import { importRepositoryToShare } from '@/utils/ai/importRepositoryToShare'
import { syncRepositoryToShare } from '@/utils/ai/syncRepositoryToShare'
import { attachGitHubCredential, importGitHubRepository, removeGitHubCredential } from '../github'
import { withRepositorySync } from './repositoryModel'
import type { WorkbenchState } from './useWorkbenchState'

export function useRepositoryManagement(
    state: WorkbenchState,
    activeConversation: AIConversation | null,
    attachRepo: (repoId: string, repo?: AIImportedRepo) => Promise<void>
) {
    const {
        isAuthenticated, importedRepos, setImportedRepos, setShares, setStatusNotice,
        importInput, setImportInput, githubToken, setGitHubToken, setImportError,
        setImportPending, setSyncingRepoId, resetShareWorkspaceCache, hydrateShareRef,
    } = state

    async function persistRepository(repo: AIImportedRepo) {
        if (!isAuthenticated) return
        const response = await aiClientRequest('/ai/repositories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(repo),
        })
        if (!response.ok) throw new Error('Unable to save repository sync state.')
    }

    function upsertRepository(repo: AIImportedRepo) {
        setImportedRepos((prev) => [repo, ...prev.filter((entry) => entry.id !== repo.id)])
        setShares((prev) => [{
            id: repo.id,
            path: repo.fullName,
            alias: repo.name,
            content: '',
            wordCount: 0,
            estimatedMinutes: 0,
            timestamp: repo.importedAt,
            git: repo.sourceUrl,
            locked: false,
            owner: getCookie('id') || '',
            parent: '',
        }, ...prev.filter((entry) => entry.id !== repo.id)])
    }

    const importRepo = useCallback(async () => {
        if (!importInput.trim()) return
        setImportPending(true)
        setImportError(null)
        let pendingRepo: AIImportedRepo | null = null
        try {
            setStatusNotice(null)
            const imported = await importGitHubRepository(importInput, undefined, githubToken)
            const existing = importedRepos.find((repo) => repo.fullName === imported.fullName
                && repo.branch === imported.branch && repo.sourcePath === imported.sourcePath)
            const repo = existing ? { ...imported, id: existing.id } : imported
            const token = getCookie('access_token')
            const userId = getCookie('id')
            pendingRepo = withRepositorySync(repo, {
                status: 'syncing', source: existing ? 'refresh' : 'import',
                message: existing ? 'Refreshing repository and syncing files...' : 'Importing repository and preparing files...',
            })
            upsertRepository(pendingRepo)
            await persistRepository(pendingRepo)
            if (githubToken.trim()) {
                const credential = await attachGitHubCredential(pendingRepo.id, githubToken.trim())
                pendingRepo = {
                    ...pendingRepo,
                    authMode: 'github_token',
                    authHint: 'Private GitHub access is stored server-side for this repository. You can revoke it here.',
                    credential,
                }
                upsertRepository(pendingRepo)
                await persistRepository(pendingRepo)
            }
            if (existing) await syncRepositoryToShare({ repo: pendingRepo, token, userId })
            else await importRepositoryToShare({ repo: pendingRepo, token, userId })
            resetShareWorkspaceCache(pendingRepo.id)
            await hydrateShareRef.current(pendingRepo.id)
            const readyRepo = withRepositorySync(pendingRepo, {
                status: 'ready', source: existing ? 'refresh' : 'import',
                message: existing ? 'Repository refresh complete.' : 'Repository imported into the editor.',
            })
            upsertRepository(readyRepo)
            setImportInput('')
            setGitHubToken('')
            await persistRepository(readyRepo)
            setStatusNotice(existing ? 'Repository refreshed and synced into the editor.' : 'Repository imported and ready in the editor.')
            await attachRepo(readyRepo.id, readyRepo)
        } catch (error) {
            if (pendingRepo) {
                const failedRepo = withRepositorySync(pendingRepo, {
                    status: 'error', source: 'import',
                    message: error instanceof Error ? error.message : 'Failed to import repository.',
                })
                upsertRepository(failedRepo)
                try { await persistRepository(failedRepo) } catch { /* Keep the local sync error. */ }
            }
            setImportError(error instanceof Error ? error.message : 'Failed to import repository.')
        } finally {
            setImportPending(false)
        }
    }, [attachRepo, githubToken, importedRepos, importInput, resetShareWorkspaceCache, setGitHubToken,
        setImportError, setImportInput, setImportPending, setStatusNotice])

    const refreshRepo = useCallback(async (repoId: string) => {
        const existing = importedRepos.find((repo) => repo.id === repoId)
        if (!existing) return
        setSyncingRepoId(repoId)
        setImportError(null)
        try {
            setStatusNotice(null)
            const pendingRepo = withRepositorySync(existing, {
                status: 'syncing', source: 'refresh', message: 'Refreshing repository from GitHub...',
            })
            upsertRepository(pendingRepo)
            await persistRepository(pendingRepo)
            const refreshed = await importGitHubRepository(existing.sourceUrl, existing.id, githubToken)
            await syncRepositoryToShare({ repo: refreshed, token: getCookie('access_token'), userId: getCookie('id') })
            resetShareWorkspaceCache(repoId)
            await hydrateShareRef.current(repoId)
            const readyRepo = withRepositorySync(refreshed, {
                status: 'ready', source: 'refresh', message: 'Repository sync complete.',
            })
            upsertRepository(readyRepo)
            setGitHubToken('')
            await persistRepository(readyRepo)
            setStatusNotice('Repository refresh complete.')
            if (activeConversation?.workspaceMeta?.repositoryId === repoId) await attachRepo(repoId, readyRepo)
        } catch (error) {
            const failedRepo = withRepositorySync(existing, {
                status: 'error', source: 'refresh',
                message: error instanceof Error ? error.message : 'Failed to refresh repository.',
            })
            upsertRepository(failedRepo)
            try { await persistRepository(failedRepo) } catch { /* Keep the local sync error. */ }
            setImportError(error instanceof Error ? error.message : 'Failed to refresh repository.')
        } finally {
            setSyncingRepoId(null)
        }
    }, [attachRepo, githubToken, importedRepos, resetShareWorkspaceCache, setGitHubToken,
        setImportError, setStatusNotice, setSyncingRepoId, activeConversation?.workspaceMeta?.repositoryId])

    const revokeRepoCredential = useCallback(async (repoId: string) => {
        const existing = importedRepos.find((repo) => repo.id === repoId)
        if (!existing) return
        await removeGitHubCredential(repoId)
        const updatedRepo = {
            ...existing,
            authMode: 'public' as const,
            authHint: null,
            credential: {
                provider: 'github_pat' as const,
                hasCredential: false,
                tokenHint: null,
                attachedAt: null,
                lastUsedAt: null,
                lastValidatedAt: null,
            },
        }
        upsertRepository(updatedRepo)
        await persistRepository(updatedRepo)
        setStatusNotice('GitHub credential removed for this repository.')
    }, [importedRepos, setStatusNotice])

    return { importRepo, refreshRepo, revokeRepoCredential }
}
