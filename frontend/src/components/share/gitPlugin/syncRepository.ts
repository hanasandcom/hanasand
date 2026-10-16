import {
    attachGitHubCredential,
    importGitHubRepository,
    persistGitHubRepository,
} from '@/components/ai/github'
import { importRepositoryToShare } from '@/utils/ai/importRepositoryToShare'
import { syncRepositoryToShare } from '@/utils/ai/syncRepositoryToShare'
import { buildLanguageOverview, readStoredGitWorkspace, rememberGitWorkspace } from './storage'
import type { GitOperationContext } from './operationContext'

export function createRepositorySync(context: GitOperationContext, loadGitStatus: (repositoryId: string) => Promise<void>) {
    return async function syncRepository(mode: 'import' | 'pull', options: { automatic?: boolean } = {}) {
        const { isSignedIn, currentInput, setError, setPending, setSyncProgress, setSyncStartedAt, setLanguageOverview, share, shareRouteId, githubToken, autoPullMinutes, accessToken, userId, setStatus, setGitHubToken, setStored } = context
        if (!isSignedIn) {
            setError('Sign in to load Git repositories.')
            return
        }
        if (!currentInput) {
            setError('Paste a GitHub repository URL or owner/repo first.')
            return
        }

        setPending(mode)
        setError(null)
        setSyncProgress(null)
        setSyncStartedAt(Date.now())
        setLanguageOverview([])
        setStatus(mode === 'pull' ? options.automatic ? 'Auto-pulling the latest repository files...' : 'Pulling the latest repository files...' : 'Loading repository into this workspace...')

        try {
            const existingId = mode === 'pull' ? share?.id || shareRouteId : undefined
            const repo = await importGitHubRepository(currentInput, existingId, githubToken)
            setLanguageOverview(buildLanguageOverview(repo.files))
            setSyncProgress({ syncedFiles: 0, totalFiles: repo.files.length, currentPath: null })
            const persistedRepo = { ...repo, syncStatus: 'syncing' as const }
            await persistGitHubRepository(persistedRepo)
            if (githubToken.trim()) await attachGitHubCredential(repo.id, githubToken.trim())

            if (mode === 'pull' && (share?.id || shareRouteId) === repo.id) {
                await syncRepositoryToShare({ repo: persistedRepo, token: accessToken, userId, onProgress: setSyncProgress })
            } else {
                await importRepositoryToShare({ repo: persistedRepo, token: accessToken, userId, onProgress: setSyncProgress })
            }

            const syncedAt = new Date().toISOString()
            await persistGitHubRepository({ ...persistedRepo, syncStatus: 'ready', lastSyncedAt: syncedAt, lastSyncError: null })
            rememberGitWorkspace(repo.id, {
                input: repo.sourceUrl || currentInput,
                fullName: repo.fullName,
                branch: repo.branch,
                sourcePath: repo.sourcePath || '',
                updatedAt: syncedAt,
                lastSyncedAt: syncedAt,
                autoPullMinutes,
            })
            setStored(readStoredGitWorkspace(repo.id))
            setGitHubToken('')
            setStatus(mode === 'pull' ? options.automatic ? 'Repository auto-pulled in the background.' : 'Repository pulled into the editor.' : 'Repository loaded. Opening it now...')

            if (options.automatic) {
                await loadGitStatus(repo.id)
            } else if (repo.id !== shareRouteId || mode === 'import') {
                window.location.assign(`/s/${repo.id}`)
            } else {
                window.location.reload()
            }
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Repository sync failed.')
            setStatus(null)
        } finally {
            setPending(null)
            setSyncStartedAt(null)
        }
    }
}
