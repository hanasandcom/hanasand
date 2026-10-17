// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WorkspacePane from '../src/components/ai/workspacePane'

test('workspace pane uses normalized metadata for repository fallback and focus summary', () => {
    const noop = () => {}
    const html = renderToStaticMarkup(createElement(WorkspacePane, {
        activeConversation: {
            workspaceId: 'repo-1',
            workspaceKind: 'repo',
            workspaceMeta: { repositoryId: 42, selectedFilePath: 'src/app.ts', recentPaths: [42] },
        },
        importedRepos: [{
            id: 'repo-1', fullName: 'acme/demo', branch: 'main', syncStatus: 'ready',
            accessScope: 'owned', ownerId: 'user-1', stackType: 'unknown', files: [{ path: 'src/app.ts', content: '' }],
        }],
        initialShares: [], deployments: [], releases: [], availableVmTargets: [],
        importInput: '', githubToken: '', importError: null, importPending: false, collaborationError: null,
        syncingRepoId: null, activeShareTree: null, selectedRepoFilePath: null,
        selectedShareFileContent: null, selectedShareContent: null, deployQuota: null, ownershipSummary: null,
        deployPending: false, collaboratorPending: false, currentUserId: null, rollbackPendingId: null,
        onAttachRepo: noop, onAttachShare: noop, onImportInputChange: noop, onGitHubTokenChange: noop,
        onImportRepo: noop, onRefreshRepo: noop, onRevokeRepoCredential: noop, onScaffoldStarter: noop,
        onStartDeployment: noop, onInviteCollaborator: noop, onRollbackRelease: noop,
        onRemoveCollaborator: noop, onSelectRepoFile: noop, onSelectShareFile: noop,
    } as Parameters<typeof WorkspacePane>[0]))

    expect(html).toContain('acme/demo')
    expect(html).toContain('src/app.ts')
    expect(html).toMatch(/>Focus<\/div><div[^>]*>src\/app\.ts<\/div>/)
    expect(html).toContain('rounded-lg px-3 py-3 outline bg-ui-primary/10 outline-ui-primary/18')
    expect(html).not.toContain('>Recent</span>')
})
