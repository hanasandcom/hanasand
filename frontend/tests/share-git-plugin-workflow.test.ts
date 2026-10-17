import { afterAll, expect, mock, test } from 'bun:test'
import type { GitOperationContext } from '../src/components/share/gitPlugin/operationContext'

const repositoryCalls: unknown[][] = []
const persistenceCalls: unknown[] = []
const credentialCalls: unknown[][] = []
const importCalls: unknown[] = []
const syncCalls: unknown[] = []
const workflowEvents: string[] = []
const repo = {
    id: 'repo-1', fullName: 'owner/repo', sourceUrl: 'https://github.com/owner/repo', branch: 'main',
    sourcePath: '', files: [{ path: 'src/main.ts' }, { path: 'README.md' }],
} as unknown as AIImportedRepo
let beforeReadyPersistence: (() => Promise<void>) | null = null

mock.module('@/components/ai/github', () => ({
    importGitHubRepository: async (...args: unknown[]) => { repositoryCalls.push(args); return repo },
    persistGitHubRepository: async (value: unknown) => {
        persistenceCalls.push(value)
        const state = (value as { syncStatus?: string }).syncStatus
        if (state === 'syncing') workflowEvents.push('persist-syncing')
        if (state === 'ready') {
            workflowEvents.push('persist-ready-start')
            await beforeReadyPersistence?.()
            workflowEvents.push('persist-ready-complete')
        }
    },
    attachGitHubCredential: async (...args: unknown[]) => { credentialCalls.push(args) },
    commitRepositoryWorkspace: async () => ({}),
    getRepositoryGitStatus: async () => ({ files: [] }),
    pullRepositoryWorkspace: async () => ({ files: [] }),
    pushRepositoryWorkspace: async () => ({ files: [] }),
}))
mock.module('@/utils/ai/importRepositoryToShare', () => ({ importRepositoryToShare: async (input: unknown) => { importCalls.push(input) } }))
mock.module('@/utils/ai/syncRepositoryToShare', () => ({ syncRepositoryToShare: async (input: unknown) => { syncCalls.push(input) } }))

const { createRepositorySync } = await import('../src/components/share/gitPlugin/syncRepository')
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
afterAll(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
})

test('import persists credentials and workspace before navigating to the new share', async () => {
    resetCalls()
    const order: string[] = []
    const stored = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) }, location: { assign: (url: string) => { order.push(`navigate:${url}`) }, reload() { order.push('reload') } } },
    })
    let releaseReadyWrite!: () => void
    let signalReadyWrite!: () => void
    const readyWriteStarted = new Promise<void>(resolve => { signalReadyWrite = resolve })
    const readyWriteGate = new Promise<void>(resolve => { releaseReadyWrite = resolve })
    beforeReadyPersistence = () => { signalReadyWrite(); return readyWriteGate }
    const context = createContext({ currentInput: 'owner/repo', githubToken: ' token ' })
    const operation = createRepositorySync(context, async () => {})('import')

    await readyWriteStarted
    expect(order).toEqual([])
    expect(workflowEvents).toEqual(['persist-syncing', 'persist-ready-start'])
    releaseReadyWrite()
    await operation

    expect(workflowEvents).toEqual(['persist-syncing', 'persist-ready-start', 'persist-ready-complete'])
    expect(order).toEqual(['navigate:/s/repo-1'])
    expect(repositoryCalls).toEqual([['owner/repo', undefined, ' token ']])
    expect(persistenceCalls).toMatchObject([{ syncStatus: 'syncing' }, { syncStatus: 'ready' }])
    expect(credentialCalls).toEqual([['repo-1', 'token']])
    expect(importCalls).toHaveLength(1)
    expect(syncCalls).toHaveLength(0)
    expect(context.events.status.at(-1)).toBe('Repository loaded. Opening it now...')
    expect(context.events.token).toEqual([''])
    expect(context.events.pending.at(-1)).toBeNull()
    expect(JSON.parse(stored.get('hanasand.share.git.repo-1') || '{}')).toMatchObject({ fullName: 'owner/repo', branch: 'main' })
})

test('automatic pull syncs the current share, refreshes status, and does not navigate', async () => {
    resetCalls()
    const order: string[] = []
    const stored = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) }, location: { assign: (url: string) => order.push(url), reload: () => order.push('reload') } },
    })
    const context = createContext({ currentInput: 'owner/repo', share: { id: 'repo-1' } as Share, githubToken: '' })
    const refreshes: string[] = []

    await createRepositorySync(context, async id => { refreshes.push(id) })('pull', { automatic: true })

    expect(repositoryCalls).toEqual([['owner/repo', 'repo-1', '']])
    expect(syncCalls).toHaveLength(1)
    expect(importCalls).toHaveLength(0)
    expect(refreshes).toEqual(['repo-1'])
    expect(context.events.status.at(-1)).toBe('Repository auto-pulled in the background.')
    expect(order).toEqual([])
})

function createContext(overrides: Partial<GitOperationContext> = {}) {
    const events = { status: [] as Array<string | null>, token: [] as string[], pending: [] as Array<string | null> }
    const context = {
        shareRouteId: 'draft', share: null, userId: 'user-1', accessToken: 'access-token', isSignedIn: true,
        currentInput: 'owner/repo', githubToken: '', autoPullMinutes: 15, commitMessage: '', selectedPaths: new Set<string>(),
        stored: null, gitStatus: null, setStatus: (value: string | null) => events.status.push(value), setError() {},
        setPending: (value: 'import' | 'pull' | 'status' | 'commit' | 'push' | null) => events.pending.push(value),
        setStored() {}, setGitStatus() {}, setSelectedPaths() {}, setCommitMessage() {},
        setGitHubToken: (value: string) => events.token.push(value), setSyncProgress() {}, setSyncStartedAt() {}, setLanguageOverview() {},
        ...overrides,
    } as GitOperationContext
    return Object.assign(context, { events })
}

function resetCalls() {
    repositoryCalls.length = 0
    persistenceCalls.length = 0
    credentialCalls.length = 0
    importCalls.length = 0
    syncCalls.length = 0
    workflowEvents.length = 0
    beforeReadyPersistence = null
}
