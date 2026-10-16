import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import type { GitOperationContext } from '../src/components/share/gitPlugin/operationContext'

type OperationName = 'status' | 'pull' | 'commit' | 'push'
const operationCalls: Array<{ name: OperationName, args: unknown[] }> = []
const failures: Partial<Record<OperationName, unknown>> = {}
const defaultStatus = { files: [{ path: 'fresh.ts' }, { path: 'second.ts' }], branchSummary: 'main' } as AIGitStatus
let nextStatus = defaultStatus

mock.module('@/components/ai/github', () => ({
    getRepositoryGitStatus: async (...args: unknown[]) => run('status', args),
    pullRepositoryWorkspace: async (...args: unknown[]) => run('pull', args),
    commitRepositoryWorkspace: async (...args: unknown[]) => ({
        ...await run('commit', args), commit: 'abc123', status: nextStatus,
    }),
    pushRepositoryWorkspace: async (...args: unknown[]) => run('push', args),
}))

const storedItems = new Map<string, string>()
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { setItem: (key: string, value: string) => storedItems.set(key, value) } },
})
const { createWorkspaceOperations } = await import('../src/components/share/gitPlugin/workspaceOperations')

afterAll(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
})

beforeEach(() => {
    nextStatus = defaultStatus
    operationCalls.length = 0
    storedItems.clear()
    Object.keys(failures).forEach(key => delete failures[key as OperationName])
})

test('signed-out actions keep their operation-specific message and do not start work', async () => {
    const guards = [
        ['Sign in to inspect Git changes.', (ops: ReturnType<typeof createWorkspaceOperations>) => ops.loadGitStatus()],
        ['Sign in to pull Git changes.', (ops: ReturnType<typeof createWorkspaceOperations>) => ops.pullGitWorkspace()],
        ['Sign in to commit Git changes.', (ops: ReturnType<typeof createWorkspaceOperations>) => ops.commitSelectedFiles()],
        ['Sign in to push Git changes.', (ops: ReturnType<typeof createWorkspaceOperations>) => ops.pushGitWorkspace()],
    ] as const

    for (const [message, action] of guards) {
        const harness = createHarness(false)
        await action(createWorkspaceOperations(harness.context))
        expect(harness.errors).toEqual([message])
        expect(harness.pending).toEqual([])
        expect(harness.statuses).toEqual([])
    }
    expect(operationCalls).toEqual([])
})

test('a rejected operation reports its error and always clears pending state', async () => {
    failures.pull = new Error('upstream rejected')
    const harness = createHarness(true)
    await createWorkspaceOperations(harness.context).pullGitWorkspace()

    expect(harness.pending).toEqual(['pull', null])
    expect(harness.errors).toEqual([null, 'upstream rejected'])
    expect(harness.statuses).toEqual(['Pulling the cached Git worktree...', null])

    failures.pull = 'invalid failure value'
    const pullFallbackHarness = createHarness(true)
    await createWorkspaceOperations(pullFallbackHarness.context).pullGitWorkspace()
    expect(pullFallbackHarness.errors).toEqual([null, 'Failed to pull Git worktree.'])
    expect(pullFallbackHarness.pending).toEqual(['pull', null])

    failures.status = 'invalid failure value'
    const fallbackHarness = createHarness(true)
    await createWorkspaceOperations(fallbackHarness.context).loadGitStatus()
    expect(fallbackHarness.errors).toEqual([null, 'Failed to load Git status.'])
    expect(fallbackHarness.pending).toEqual(['status', null])

    failures.push = 'invalid failure value'
    const pushHarness = createHarness(true)
    await createWorkspaceOperations(pushHarness.context).pushGitWorkspace()
    expect(pushHarness.errors).toEqual([null, 'Failed to push repository.'])
    expect(pushHarness.pending).toEqual(['push', null])

    failures.commit = new Error('commit failed')
    const commitHarness = createHarness(true)
    await createWorkspaceOperations(commitHarness.context).commitSelectedFiles()
    expect(commitHarness.errors).toEqual([null, 'commit failed'])
    expect(commitHarness.getCommitMessage()).toBe('commit message')
    expect(commitHarness.selectedPaths).toEqual(new Set(['existing.ts']))

    failures.commit = 'invalid failure value'
    const commitFallbackHarness = createHarness(true)
    await createWorkspaceOperations(commitFallbackHarness.context).commitSelectedFiles()
    expect(commitFallbackHarness.errors).toEqual([null, 'Failed to commit staged files.'])
})

test('status refresh preserves last-sync time while pull and push advance it', async () => {
    const stored = storedWorkspace()
    const statusHarness = createHarness(true, stored)
    await createWorkspaceOperations(statusHarness.context).loadGitStatus()
    expect(statusHarness.getStored()?.updatedAt).not.toBe('old-update')
    expect(statusHarness.getStored()?.lastSyncedAt).toBe('old-sync')
    expect(statusHarness.getStored()?.autoPullMinutes).toBe(30)
    expect(statusHarness.gitStatuses).toEqual([nextStatus])
    expect(statusHarness.selectedPaths).toEqual(new Set(['fresh.ts', 'second.ts']))
    expect(statusHarness.statuses).toEqual(['Checking Git changes...', '2 changed files ready to stage.'])
    expect(operationCalls[0]).toEqual({ name: 'status', args: ['share-route', 'canonical-share'] })

    for (const operation of ['pull', 'push'] as const) {
        const harness = createHarness(true, stored)
        const operations = createWorkspaceOperations(harness.context)
        await operations[operation === 'pull' ? 'pullGitWorkspace' : 'pushGitWorkspace']()

        const updated = harness.getStored()
        expect(updated?.lastSyncedAt).not.toBe('old-sync')
        expect(updated?.lastSyncedAt).toBe(updated?.updatedAt)
        expect(updated?.autoPullMinutes).toBe(30)
        expect(JSON.parse(storedItems.get('hanasand.share.git.share-route') || '{}')).toEqual(updated)
        expect(harness.selectedPaths).toEqual(new Set(['fresh.ts', 'second.ts']))
        expect(operationCalls.at(-1)).toEqual({ name: operation, args: ['share-route'] })
        expect(harness.statuses).toEqual(operation === 'pull'
            ? ['Pulling the cached Git worktree...', 'Remote changes pulled into the Git worktree.']
            : ['Pushing commits...', 'Pushed to the remote repository.'])
    }
})

test('status override and singular or empty results retain their messages', async () => {
    const overrideHarness = createHarness(true)
    await createWorkspaceOperations(overrideHarness.context).loadGitStatus('repo-override')
    expect(operationCalls[0]).toEqual({ name: 'status', args: ['repo-override', 'canonical-share'] })

    nextStatus = { files: [{ path: 'only.ts' }], branchSummary: 'main' }
    const singularHarness = createHarness(true)
    await createWorkspaceOperations(singularHarness.context).loadGitStatus()
    expect(singularHarness.statuses.at(-1)).toBe('1 changed file ready to stage.')

    nextStatus = { files: [], branchSummary: null }
    const emptyHarness = createHarness(true)
    await createWorkspaceOperations(emptyHarness.context).loadGitStatus()
    expect(emptyHarness.statuses.at(-1)).toBe('No Git changes in the editor.')
})

test('commit uses the staged paths and clears the message after success', async () => {
    const harness = createHarness(true)
    await createWorkspaceOperations(harness.context).commitSelectedFiles()

    expect(operationCalls).toEqual([{ name: 'commit', args: ['share-route', 'canonical-share', 'commit message', ['existing.ts']] }])
    expect(harness.getCommitMessage()).toBe('')
    expect(harness.gitStatuses).toEqual([nextStatus])
    expect(harness.selectedPaths).toEqual(new Set(['fresh.ts', 'second.ts']))
    expect(harness.statuses).toEqual(['Committing 1 staged file...', 'Committed abc123.'])
})

async function run(name: OperationName, args: unknown[]) {
    operationCalls.push({ name, args })
    if (failures[name]) throw failures[name]
    return nextStatus
}

function createHarness(isSignedIn: boolean, initialStored: StoredGitWorkspace | null = null) {
    let stored = initialStored
    let selectedPaths = new Set(['existing.ts'])
    let commitMessage = 'commit message'
    const errors: Array<string | null> = []
    const statuses: Array<string | null> = []
    const pending: Array<string | null> = []
    const gitStatuses: Array<AIGitStatus | null> = []
    const context = {
        shareRouteId: 'share-route', userId: 'user-1', accessToken: 'token', isSignedIn,
        currentInput: '', githubToken: '', autoPullMinutes: 30, commitMessage,
        selectedPaths, stored, gitStatus: null, share: { id: 'canonical-share' },
        setStatus: (value: string | null) => statuses.push(value),
        setError: (value: string | null) => errors.push(value),
        setPending: (value: 'import' | 'pull' | 'status' | 'commit' | 'push' | null) => pending.push(value),
        setStored: (next: StoredGitWorkspace | null | ((previous: StoredGitWorkspace | null) => StoredGitWorkspace | null)) => {
            stored = typeof next === 'function' ? next(stored) : next
        },
        setGitStatus: (value: AIGitStatus | null) => gitStatuses.push(value),
        setSelectedPaths: (next: Set<string> | ((previous: Set<string>) => Set<string>)) => {
            selectedPaths = typeof next === 'function' ? next(selectedPaths) : next
        },
        setCommitMessage: (value: string) => { commitMessage = value },
        setGitHubToken: () => undefined,
        setSyncProgress: () => undefined,
        setSyncStartedAt: () => undefined,
        setLanguageOverview: () => undefined,
    } as unknown as GitOperationContext

    return {
        context, errors, statuses, pending, gitStatuses, getStored: () => stored, getCommitMessage: () => commitMessage,
        get selectedPaths() { return selectedPaths },
    }
}

function storedWorkspace(): StoredGitWorkspace {
    return {
        input: 'owner/repo', fullName: 'owner/repo', branch: 'main', sourcePath: '',
        updatedAt: 'old-update', lastSyncedAt: 'old-sync', autoPullMinutes: 5,
    }
}
