import { expect, mock, test } from 'bun:test'

type RequestRecord = { path: string, method: string | undefined, body: BodyInit | null | undefined }

const requests: RequestRecord[] = []
let nextResponse = Response.json({})

mock.module('@/utils/ai/client', () => ({
    aiClientRequest: async (path: string, init?: RequestInit) => {
        requests.push({ path, method: init?.method, body: init?.body })
        return nextResponse
    },
}))

const github = await import('../src/components/ai/github')

test('GitHub operations retain their endpoints, methods, payloads, and success values', async () => {
    requests.length = 0
    nextResponse = Response.json({ id: 'repo-1' })
    const imported = await github.importGitHubRepository('owner/repo', 'existing', ' token ')
    expect(imported).toMatchObject({
        id: 'repo-1', authMode: 'public', authHint: null, syncStatus: 'syncing',
        lastSyncedAt: null, lastSyncError: null, syncHistory: [],
        credential: { provider: 'github_pat', hasCredential: false },
    })
    expect(requests[0]).toEqual({
        path: '/ai/import-repository', method: 'POST',
        body: JSON.stringify({ input: 'owner/repo', existingId: 'existing', githubToken: 'token' }),
    })

    const credential = { provider: 'github_pat', hasCredential: true } as AIRepositoryCredentialSummary
    nextResponse = Response.json({ credential })
    expect(await github.attachGitHubCredential('repo/1', 'secret')).toEqual(credential)
    nextResponse = Response.json({ saved: true })
    expect(await github.persistGitHubRepository({ id: 'repo-1' } as AIImportedRepo)).toBeUndefined()
    nextResponse = Response.json({ removed: true })
    expect(await github.removeGitHubCredential('repo/1')).toBeUndefined()

    const status = { files: [], branchSummary: 'main' } as AIGitStatus
    nextResponse = Response.json(status)
    expect(await github.getRepositoryGitStatus('repo/1', 'share id')).toEqual(status)
    nextResponse = Response.json(status)
    expect(await github.pullRepositoryWorkspace('repo-1')).toEqual(status)
    const commit = { ok: true, commit: 'abc123', status }
    nextResponse = Response.json(commit)
    expect(await github.commitRepositoryWorkspace('repo-1', 'share-1', 'message', ['src/a.ts'])).toEqual(commit)
    nextResponse = Response.json(status)
    expect(await github.pushRepositoryWorkspace('repo-1')).toEqual(status)

    expect(requests.slice(1).map(({ path, method }) => [path, method])).toEqual([
        ['/ai/repositories/repo%2F1/credentials/github', 'PUT'],
        ['/ai/repositories', 'POST'],
        ['/ai/repositories/repo%2F1/credentials/github', 'DELETE'],
        ['/ai/repositories/repo%2F1/git/status?shareId=share%20id', undefined],
        ['/ai/repositories/repo-1/git/pull', 'POST'],
        ['/ai/repositories/repo-1/git/commit', 'POST'],
        ['/ai/repositories/repo-1/git/push', 'POST'],
    ])
    expect(requests[1].body).toBe(JSON.stringify({ githubToken: 'secret' }))
    expect(requests[2].body).toBe(JSON.stringify({ id: 'repo-1' }))
    expect(requests[6].body).toBe(JSON.stringify({ shareId: 'share-1', message: 'message', paths: ['src/a.ts'] }))
})

test('each GitHub operation keeps its fallback and server-provided errors', async () => {
    const operations: Array<[string, () => Promise<unknown>]> = [
        ['Failed to import repository.', () => github.importGitHubRepository('owner/repo')],
        ['Failed to save GitHub credential.', () => github.attachGitHubCredential('repo', 'token')],
        ['Failed to save repository sync state.', () => github.persistGitHubRepository({ id: 'repo' } as AIImportedRepo)],
        ['Failed to remove GitHub credential.', () => github.removeGitHubCredential('repo')],
        ['Failed to load Git status.', () => github.getRepositoryGitStatus('repo', 'share')],
        ['Failed to pull repository.', () => github.pullRepositoryWorkspace('repo')],
        ['Failed to commit staged files.', () => github.commitRepositoryWorkspace('repo', 'share', 'message', [])],
        ['Failed to push repository.', () => github.pushRepositoryWorkspace('repo')],
    ]

    for (const [message, operation] of operations) {
        nextResponse = new Response('invalid json', { status: 503 })
        await expect(operation()).rejects.toThrow(message)
    }

    nextResponse = Response.json({ error: 'GitHub denied access.' }, { status: 403 })
    await expect(github.pullRepositoryWorkspace('repo')).rejects.toThrow('GitHub denied access.')
})
