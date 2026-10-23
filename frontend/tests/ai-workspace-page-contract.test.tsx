// @ts-expect-error Bun provides this module when running tests.
import { mock, test, expect } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let cookieValues: Record<string, string | undefined> = {}
let sharesValue: unknown = []
const receivedProps: Record<string, unknown>[] = []
const calls: Array<{ name: string, value?: unknown }> = []
let pendingCookies: Promise<unknown> | null = null

mock.module('next/headers', () => ({
    headers: async () => new Headers(),
    cookies: async () => {
        calls.push({ name: 'cookies' })
        if (pendingCookies) await pendingCookies
        return { get: (name: string) => ({ value: cookieValues[name] }) }
    },
}))
mock.module('server-only', () => ({}))
mock.module('next/link', () => ({
    default: ({ href, children, className }: { href: string, children: ReactNode, className?: string }) =>
        createElement('a', { href, className }, children),
}))
mock.module('@/utils/share/getUserShares', () => ({
    getUserShares: async (input: unknown) => {
        calls.push({ name: 'shares', value: input })
        return sharesValue
    },
}))
mock.module('@/utils/ai/getWorkspace', () => ({
    getAiWorkspace: async (input: unknown) => {
        calls.push({ name: 'workspace', value: input })
        return {
            authStatus: 'ready',
            conversations: [{ id: 'conversation-1' }],
            repositories: [{ id: 'repository-1' }],
            deployments: [{ id: 'deployment-1' }],
            releases: [{ id: 'release-1' }],
            deployQuota: { available: 2 },
            ownershipSummary: { owned: 1 },
            runtimeState: { state: 'ready' },
        }
    },
}))
mock.module('../src/app/ai/pageClient', () => ({
    default: (props: Record<string, unknown>) => {
        receivedProps.push(props)
        return createElement('div', { 'data-ai-workspace': 'ready' })
    },
}))

const { default: AIPage } = await import('../src/app/ai/page')
const { default: AIWindowPage } = await import('../src/app/ai/window/page')
const { default: AIConversationPage } = await import('../src/app/ai/[id]/page')
const { default: WorkspacePane } = await import('../src/components/ai/workspacePane')
const { WorkspaceFileButton } = await import('../src/components/ai/workspaceFileButton')

function renderWorkspacePane() {
    const noop = () => {}
    const props = {
        activeConversation: null,
        importedRepos: [],
        importInput: '',
        githubToken: '',
        importError: null,
        importPending: false,
        collaborationError: null,
        initialShares: [{ id: 'file-share-1', alias: 'brief.md', path: 'docs/brief.md' } as Share],
        syncingRepoId: null,
        activeShareTree: null,
        selectedRepoFilePath: null,
        selectedShareFileContent: null,
        selectedShareContent: null,
        deployments: [],
        releases: [],
        deployQuota: null,
        availableVmTargets: [],
        deployPending: false,
        collaboratorPending: false,
        currentUserId: null,
        rollbackPendingId: null,
        onAttachRepo: noop,
        onAttachShare: noop,
        onImportInputChange: noop,
        onGitHubTokenChange: noop,
        onImportRepo: noop,
        onRefreshRepo: noop,
        onRevokeRepoCredential: noop,
        onScaffoldStarter: noop,
        onStartDeployment: noop,
        onInviteCollaborator: noop,
        onRollbackRelease: noop,
        onRemoveCollaborator: noop,
        onSelectRepoFile: noop,
        onSelectShareFile: noop,
    } as Parameters<typeof WorkspacePane>[0]
    return renderToStaticMarkup(createElement(WorkspacePane, props))
}

function resetState() {
    cookieValues = { id: 'user-1', access_token: 'token-1' }
    sharesValue = [{ id: 'share-1' }]
    pendingCookies = null
    calls.length = 0
    receivedProps.length = 0
}

function currentProps() {
    const props = receivedProps.at(-1)
    if (!props) throw new Error('AIPageClient did not render')
    return props
}

test('all workspace routes pass the same server data and preserve route selection', async () => {
    resetState()
    expect(renderToStaticMarkup(await AIPage())).toContain('data-ai-workspace="ready"')
    const indexProps = currentProps()
    expect(indexProps).toEqual({
        initialConversations: [{ id: 'conversation-1' }],
        initialRepositories: [{ id: 'repository-1' }],
        initialDeployments: [{ id: 'deployment-1' }],
        initialReleases: [{ id: 'release-1' }],
        initialDeployQuota: { available: 2 },
        initialOwnershipSummary: { owned: 1 },
        initialShares: [{ id: 'share-1' }],
        initialRuntimeState: { state: 'ready' },
        isAuthenticated: true,
        initialWorkspaceUnavailable: false,
        canUseChatGPT: false,
        mode: 'workspace',
    })

    renderToStaticMarkup(await AIWindowPage())
    expect(currentProps()).not.toHaveProperty('initialConversationId')
    renderToStaticMarkup(await AIConversationPage({ params: Promise.resolve({ id: 'conversation-2' }) }))
    expect(currentProps().initialConversationId).toBe('conversation-2')
    expect(currentProps().mode).toBe('workspace')
})

test('conversation params and cookies resolve in parallel; missing auth skips share loading', async () => {
    resetState()
    let resolveCookies!: () => void
    pendingCookies = new Promise<void>(resolve => { resolveCookies = resolve })
    let resolveParams!: (value: { id: string }) => void
    const params = new Promise<{ id: string }>(resolve => { resolveParams = resolve })
    const page = AIConversationPage({ params })

    expect(calls.map(call => call.name)).toEqual(['cookies'])
    cookieValues = { id: 'user-2' }
    resolveCookies()
    await Promise.resolve()
    expect(calls.map(call => call.name)).toEqual(['cookies'])
    resolveParams({ id: 'conversation-3' })
    renderToStaticMarkup(await page)

    expect(calls.map(call => call.name)).toEqual(['cookies', 'workspace'])
    expect(calls.at(-1)?.value).toEqual({ id: 'user-2', token: undefined })
    expect(currentProps().isAuthenticated).toBe(false)
    expect(currentProps().initialShares).toEqual([])
    expect(currentProps().initialConversationId).toBe('conversation-3')
})

test('workspace pane actions render with shared theme tokens and expected labels', () => {
    const html = renderWorkspacePane()
    expect(html).toContain('Create repository</button>')
    expect(html).toContain('Attach repository</button>')
    expect(html).toContain('grid min-w-0 grid-cols-1 gap-3')
    expect(html).toContain('Repository files')
    expect(html).toContain('Attach file')
    expect(html).toContain('aria-label="Repository panel sections" role="group"')
    expect(html).toContain('aria-label="repositories panel"')
    expect(html).toContain('aria-pressed="true" aria-controls="repository-panel-content"')
    expect(html).toContain('aria-pressed="false" aria-controls="repository-panel-content"')
    expect(html).toContain('>Repositories</button>')
    expect(html).toContain('>Activity</button>')
    expect(html).toContain('>Access</button>')
    expect(html).toContain('>Launch</button>')
    expect(html).not.toMatch(/Invite an editor or reviewer|Launch (?:report|history|check)|Invite collaborator|Run launch check/i)
    expect(html).not.toContain('title=\'Shares\'')
    expect(html).not.toMatch(/rounded-(?:xl|2xl|3xl)/)
})

test('shared workspace file buttons keep selected and changed file labels', () => {
    const base = { path: 'src/app.ts', recentPaths: [], lastChangedPath: null, onSelect() {} }
    const selected = renderToStaticMarkup(createElement(WorkspaceFileButton, { ...base, selected: true }))
    const changed = renderToStaticMarkup(createElement(WorkspaceFileButton, { ...base, selected: false, lastChangedPath: base.path }))
    const recent = renderToStaticMarkup(createElement(WorkspaceFileButton, { ...base, selected: false, recentPaths: [base.path] }))
    const selectedPaths: string[] = []
    const button = WorkspaceFileButton({ ...base, selected: false, onSelect: path => selectedPaths.push(path) })
    button.props.onClick?.()
    expect(selected).toContain('src/app.ts')
    expect(selected).toContain('>Open</span>')
    expect(changed).toContain('>Changed</span>')
    expect(recent).toContain('>Recent</span>')
    expect(selected).toContain('bg-ui-primary/12 text-ui-on-primary')
    expect(changed).toContain('bg-ui-raised text-ui-muted')
    expect(selectedPaths).toEqual([base.path])
})
