// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkspaceRepositoryPanel } from '../src/components/ai/workspaceRepositoryPanel'

const noop = () => {}

test('repository panel associates selected styling with imported and file-backed repositories', () => {
    const repositories = [repository('repo-selected', 'selected-repository'), repository('repo-idle', 'idle-repository')]
    const conversation = activeConversation('share-selected')
    const repositoryHtml = renderToStaticMarkup(createElement(WorkspaceRepositoryPanel, {
        importedRepos: repositories, initialShares: [share('share-selected', 'selected-share'), share('share-idle', 'idle-share')],
        activeConversation: conversation, activeRepoId: 'repo-selected', syncingRepoId: null,
        selectedRepoFilePath: null, recentPaths: [], lastChangedPath: null,
        activeTreePaths: [], selectedContent: null, importInput: '', githubToken: '', importError: null, importPending: false,
        onAttachRepo: noop, onAttachShare: noop, onImportInputChange: noop, onGitHubTokenChange: noop, onImportRepo: noop,
        onCreateRepository: noop, onRevokeRepoCredential: noop, onRefreshRepo: noop, onSelectRepoFile: noop, onSelectShareFile: noop,
    }))

    expectCardState(repositoryHtml, 'selected-repository', true)
    expectCardState(repositoryHtml, 'idle-repository', false)
    expectCardState(repositoryHtml, 'selected-share', true)
    expectCardState(repositoryHtml, 'idle-share', false)
    expect(repositoryHtml).not.toContain('Shares')
    expect(repositoryHtml).toContain('for="workspace-repository-url"')
    expect(repositoryHtml).toContain('for="workspace-repository-name"')
    expect(repositoryHtml.match(/type="submit"/g)).toHaveLength(2)
    expect(repositoryHtml).toContain('aria-label="GitHub token for a private repository (optional)"')
})

function expectCardState(html: string, label: string, selected: boolean) {
    const labelPosition = html.indexOf(label)
    expect(labelPosition, `rendered label: ${label}`).toBeGreaterThanOrEqual(0)
    const cardStart = html.lastIndexOf('<div class="rounded-lg px-3 py-3 outline ', labelPosition)
    expect(cardStart, `card wrapper for ${label}`).toBeGreaterThanOrEqual(0)
    const cardEnd = html.indexOf('>', cardStart)
    const classes = html.slice(cardStart, cardEnd)
    expect(classes).toContain(selected ? 'bg-ui-primary/10 outline-ui-primary/18' : 'bg-ui-panel outline-ui-border')
}

function repository(id: string, fullName: string): AIImportedRepo {
    return {
        id, ownerId: 'owner-1', accessScope: 'owned', name: fullName.split('/')[1], fullName,
        branch: 'main', defaultBranch: 'main', sourcePath: '/workspace/repo', sourceUrl: 'https://example.test/repo',
        authMode: 'public', authHint: null, syncStatus: 'ready', lastSyncedAt: null, lastSyncError: null,
        syncHistory: [], stackType: 'unknown', stackReason: null, stackSupported: false, files: [], truncated: false,
        importedAt: '2026-10-17T10:00:00.000Z',
        credential: { provider: 'github_pat', hasCredential: false, tokenHint: null, attachedAt: null, lastUsedAt: null, lastValidatedAt: null },
    }
}

function share(id: string, alias: string): Share {
    return { id, path: `/${id}`, content: '', wordCount: 0, estimatedMinutes: 0, timestamp: '2026-10-17T10:00:00.000Z', git: null, locked: false, owner: 'owner-1', parent: '', alias }
}

function activeConversation(workspaceId: string): AIConversation {
    return {
        id: 'conversation-1', ownerId: 'owner-1', title: 'Review', preferredModel: null, activeModel: null,
        modelStrategy: 'auto', workspaceId, workspaceKind: 'share', shareIds: [], workspaceMeta: {}, messages: [],
        collaboration: { role: 'owner', canInvite: true, seatLimit: 2, seatCount: 0, remainingSeats: 2, collaborators: [] },
        metrics: { conversationId: 'conversation-1', status: 'idle', currentTokens: 0, maxTokens: 0, promptTokens: 0, generatedTokens: 0, contextTokens: 0, contextMaxTokens: 0, tps: 0, lastUpdated: null, lastError: null },
        createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:00.000Z',
    }
}
