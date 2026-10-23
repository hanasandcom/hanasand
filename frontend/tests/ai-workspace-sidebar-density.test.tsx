// @ts-expect-error Bun provides this module when running tests.
import { mock, expect, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'

mock.module('next/link', () => ({
    default: ({ href, children, className }: { href: string, children: ReactNode, className?: string }) =>
        createElement('a', { href, className }, children),
}))

const { WorkspaceRepositoryPanel } = await import('../src/components/ai/workspaceRepositoryPanel')
const { WorkspaceCollaborationPanel } = await import('../src/components/ai/workspaceCollaborationPanel')
const { WorkspaceDeployPanel } = await import('../src/components/ai/workspaceDeployPanel')
const { WorkspaceReleasePanels } = await import('../src/components/ai/workspaceReleasePanels')

const noop = () => {}

test('mobile repository drawer constrains its height and scrolls the selected section', async () => {
    const pageClient = await readFile(new URL('../src/app/ai/pageClient.tsx', import.meta.url), 'utf8')
    const workspacePane = await readFile(new URL('../src/components/ai/workspacePane.tsx', import.meta.url), 'utf8')

    expect(pageClient).toContain('absolute right-0 top-0 z-40 h-full max-h-[calc(100dvh-5rem)] min-h-0')
    expect(pageClient).toContain('lg:h-full lg:max-h-none')
    expect(workspacePane).toContain('h-full max-h-full min-h-0')
    expect(workspacePane).toContain('className=\'min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain pr-1\'')
    expect(workspacePane).toContain('lg:h-full lg:max-h-none')
})

test('empty repository panel shows both actions without a duplicate empty card', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceRepositoryPanel, {
        importedRepos: [], initialShares: [], activeConversation: null, activeRepoId: null, syncingRepoId: null,
        selectedRepoFilePath: null, activeTreePaths: [], selectedContent: null, recentPaths: [], lastChangedPath: null,
        importInput: '', githubToken: '', importError: null, importPending: false,
        onAttachRepo: noop, onAttachShare: noop, onImportInputChange: noop, onGitHubTokenChange: noop,
        onImportRepo: noop, onCreateRepository: noop, onRevokeRepoCredential: noop, onRefreshRepo: noop,
        onSelectRepoFile: noop, onSelectShareFile: noop,
    }))

    expect(html).toContain('Attach repository')
    expect(html).toContain('Create repository')
    expect(html).toContain('aria-pressed="true"')
    expect(html).not.toContain('No repositories yet')
    expect(html).not.toContain('Shares')
    expect(html).not.toContain('workspace-repository-name')
})

test('access panel reports seat usage once', () => {
    const conversation = {
        id: 'conversation-1', ownerId: 'eirikhanasand',
        collaboration: { role: 'owner', canInvite: true, seatLimit: 5, seatCount: 0, remainingSeats: 5, collaborators: [] },
    } as AIConversation
    const html = renderToStaticMarkup(createElement(WorkspaceCollaborationPanel, {
        activeConversation: conversation, currentUserId: null, collaboratorPending: false, collaborationError: null,
        onInviteCollaborator: noop, onRemoveCollaborator: noop,
    }))

    expect(html).toContain('0/5 used')
    expect(html).not.toContain('Collaborator seats remaining')
})

test('launch options stay collapsed and empty launch history renders no empty cards', () => {
    const launchHtml = renderToStaticMarkup(createElement(WorkspaceDeployPanel, {
        availableVmTargets: [], activeRepo: null, activeConversation: null, deployQuota: null,
        deployPending: false, deployments: [], onStartDeployment: noop,
    }))
    const historyHtml = renderToStaticMarkup(createElement(WorkspaceReleasePanels, {
        trustRelease: null, trust: null, launchReport: [], releases: [], rollbackPendingId: null,
        onRollbackRelease: noop,
    }))

    expect(launchHtml).toContain('Run launch check')
    expect(launchHtml).toContain('More launch options and checks')
    expect(launchHtml).toContain('Launch checklist')
    expect(launchHtml).not.toContain('<details open')
    expect(launchHtml).not.toContain('No launch attempts recorded')
    expect(historyHtml).toBe('')
})
