'use client'

import { aiClientRequest } from '@/utils/ai/client'

async function requestGitHubJson<T>(path: string, init: RequestInit | undefined, fallbackMessage: string) {
    const response = await aiClientRequest(path, init)
    const body = await response.json().catch(() => null) as (T & { error?: string }) | null
    if (!response.ok) throw new Error(body?.error || fallbackMessage)
    return body
}

export async function importGitHubRepository(input: string, existingId?: string, githubToken?: string) {
    const body = await requestGitHubJson<Partial<AIImportedRepo>>('/ai/import-repository', {
        method: 'POST',
        body: JSON.stringify({ input, existingId, githubToken: githubToken?.trim() || undefined }),
    }, 'Failed to import repository.')

    return {
        ...body,
        authMode: body?.authMode || 'public',
        authHint: body?.authHint || null,
        credential: body?.credential && typeof body.credential === 'object'
            ? body.credential
            : {
                provider: 'github_pat',
                hasCredential: false,
                tokenHint: null,
                attachedAt: null,
                lastUsedAt: null,
                lastValidatedAt: null,
            },
        syncStatus: body?.syncStatus || 'syncing',
        lastSyncedAt: body?.lastSyncedAt || null,
        lastSyncError: body?.lastSyncError || null,
        syncHistory: Array.isArray(body?.syncHistory) ? body.syncHistory : [],
    } as AIImportedRepo
}

export async function attachGitHubCredential(repositoryId: string, githubToken: string) {
    const body = await requestGitHubJson<{ credential?: AIRepositoryCredentialSummary }>(`/ai/repositories/${encodeURIComponent(repositoryId)}/credentials/github`, {
        method: 'PUT',
        body: JSON.stringify({ githubToken }),
    }, 'Failed to save GitHub credential.')

    return body?.credential as AIRepositoryCredentialSummary
}

export async function persistGitHubRepository(repo: AIImportedRepo) {
    await requestGitHubJson<Record<string, unknown>>('/ai/repositories', {
        method: 'POST',
        body: JSON.stringify(repo),
    }, 'Failed to save repository sync state.')
}

export async function removeGitHubCredential(repositoryId: string) {
    await requestGitHubJson<Record<string, unknown>>(`/ai/repositories/${encodeURIComponent(repositoryId)}/credentials/github`, {
        method: 'DELETE',
    }, 'Failed to remove GitHub credential.')
}

export async function getRepositoryGitStatus(repositoryId: string, shareId: string) {
    const body = await requestGitHubJson<AIGitStatus>(`/ai/repositories/${encodeURIComponent(repositoryId)}/git/status?shareId=${encodeURIComponent(shareId)}`, undefined, 'Failed to load Git status.')

    return body as AIGitStatus
}

export async function pullRepositoryWorkspace(repositoryId: string) {
    const body = await requestGitHubJson<AIGitStatus>(`/ai/repositories/${encodeURIComponent(repositoryId)}/git/pull`, {
        method: 'POST',
    }, 'Failed to pull repository.')

    return body as AIGitStatus
}

export async function commitRepositoryWorkspace(repositoryId: string, shareId: string, message: string, paths: string[]) {
    const body = await requestGitHubJson<{ ok: true, commit: string, status: AIGitStatus }>(`/ai/repositories/${encodeURIComponent(repositoryId)}/git/commit`, {
        method: 'POST',
        body: JSON.stringify({ shareId, message, paths }),
    }, 'Failed to commit staged files.')

    return body as { ok: true, commit: string, status: AIGitStatus }
}

export async function pushRepositoryWorkspace(repositoryId: string) {
    const body = await requestGitHubJson<AIGitStatus>(`/ai/repositories/${encodeURIComponent(repositoryId)}/git/push`, {
        method: 'POST',
    }, 'Failed to push repository.')

    return body as AIGitStatus
}
