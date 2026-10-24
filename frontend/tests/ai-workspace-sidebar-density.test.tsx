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
const { WorkspaceRecentActivityPanel } = await import('../src/components/ai/workspaceRecentActivityPanel')
const { WorkspaceDeployPanel } = await import('../src/components/ai/workspaceDeployPanel')
const { WorkspaceReleasePanels } = await import('../src/components/ai/workspaceReleasePanels')
const WorkspacePane = (await import('../src/components/ai/workspacePane')).default

const noop = () => {}

test('mobile repository drawer constrains its height and scrolls the selected section', async () => {
    const pageClient = await readFile(new URL('../src/app/ai/pageClient.tsx', import.meta.url), 'utf8')
    const workspacePane = await readFile(new URL('../src/components/ai/workspacePane.tsx', import.meta.url), 'utf8')

    expect(pageClient).toContain('absolute right-0 top-0 z-40 h-fit max-h-[calc(100dvh-5rem)] min-h-0')
    expect(pageClient).toContain('self-start')
    expect(pageClient).toContain('lg:h-full lg:max-h-none')
    expect(workspacePane).toContain('h-fit max-h-[calc(100dvh-5rem)] min-h-0')
    expect(workspacePane).toContain('lg:h-full lg:max-h-none')
    expect(workspacePane).toContain('role=\'tabpanel\'')
    expect(workspacePane).toContain('min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain')
})

test('mobile repository panel keeps its controls inside the bounded scroll region', async () => {
    const workspacePane = await readFile(new URL('../src/components/ai/workspacePane.tsx', import.meta.url), 'utf8')
    const collaborationPanel = await readFile(new URL('../src/components/ai/workspaceCollaborationPanel.tsx', import.meta.url), 'utf8')

    expect(workspacePane).toContain('max-h-[calc(100dvh-5rem)]')
    expect(workspacePane).toContain('overflow-y-auto overscroll-contain')
    expect(collaborationPanel).toContain('Invite collaborator')
    expect(collaborationPanel).not.toMatch(/sticky|fixed/)
})

test('repository drawer shows only the selected section instead of stacking every panel', () => {
    const html = renderToStaticMarkup(createElement(WorkspacePane, {
        activeConversation: null, importedRepos: [], importInput: '', githubToken: '', importError: null, importPending: false,
        collaborationError: null, initialShares: [], syncingRepoId: null, activeShareTree: null,
        selectedRepoFilePath: null, selectedShareFileContent: null, selectedShareContent: null,
        deployments: [], releases: [], deployQuota: null, availableVmTargets: [], deployPending: false,
        collaboratorPending: false, currentUserId: null, rollbackPendingId: null,
        onClose: noop, onAttachRepo: noop, onAttachShare: noop, onImportInputChange: noop,
        onGitHubTokenChange: noop, onImportRepo: noop, onRefreshRepo: noop, onRevokeRepoCredential: noop,
        onScaffoldStarter: noop, onStartDeployment: noop, onInviteCollaborator: noop, onRollbackRelease: noop,
        onRemoveCollaborator: noop, onSelectRepoFile: noop, onSelectShareFile: noop,
    }))

    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('aria-labelledby="repository-tab-repositories"')
    expect(html).toContain('Add a repository')
    expect(html).not.toContain('REPOSITORIES')
    expect(html).not.toContain('Review access')
    expect(html).not.toContain('Run launch check')
    expect(html).not.toContain('Launch report')
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
        id: 'conversation-1', ownerId: '',
        collaboration: { role: 'owner', canInvite: true, seatLimit: 5, seatCount: 0, remainingSeats: 5, collaborators: [] },
    } as AIConversation
    const html = renderToStaticMarkup(createElement(WorkspaceCollaborationPanel, {
        activeConversation: conversation, currentUserId: null, collaboratorPending: false, collaborationError: null,
        onInviteCollaborator: noop, onRemoveCollaborator: noop,
    }))

    expect(html).toContain('0/5 used')
    expect(html).toContain('You')
    expect(html).not.toContain('Collaborator seats remaining')
    expect(html).toContain('aria-label="Collaborator role"')
    expect(html).toContain('appearance-none')
    expect(html).toContain('overflow-hidden rounded-lg')
    expect(html).toContain('block h-11 w-full max-w-full min-w-0 truncate appearance-none')
    expect(html).toContain('pointer-events-none absolute right-2.5')
    expect(html).toContain('h-11')
    expect(html.match(/rounded-lg bg-ui-raised/g)?.length).toBe(1)
})

test('activity tab explains when no repository activity has been recorded', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceRecentActivityPanel, {
        lastWorkspaceAction: null, lastWorkspaceActionAt: null, lastChangedPath: null, recentPaths: [],
    }))

    expect(html).toContain('No activity yet.')
    expect(html).toContain('Code changes will appear here when a repository is updated.')
})

test('activity tab shows recent change details when activity exists', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceRecentActivityPanel, {
        lastWorkspaceAction: 'Updated package.json', lastWorkspaceActionAt: '2026-10-23T09:00:00.000Z',
        lastChangedPath: 'package.json', recentPaths: ['package.json'],
    }))

    expect(html).toContain('Updated package.json')
    expect(html).toContain('package.json')
    expect(html).toContain('1 recent path')
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
