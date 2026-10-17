import { afterEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import GitPlugin from '../src/components/share/gitPlugin'
import MetadataSidebar from '../src/components/share/metadata/MetadataSidebar'
import { buildLanguageOverview, formatEta, formatSyncTime } from '../src/components/share/gitPlugin/storage'
import { applyGitStatus } from '../src/components/share/gitPlugin/workspaceOperations'
import type { GitOperationContext } from '../src/components/share/gitPlugin/operationContext'

describe('share Git plugin presentation data', () => {
    afterEach(() => {
        Date.now = originalNow
    })

    test('groups and ranks repository files by language', () => {
        const files = [
            { path: 'src/app.tsx', name: 'app.tsx', content: '' },
            { path: 'src/api.ts', name: 'api.ts', content: '' },
            { path: 'scripts/build.js', name: 'build.js', content: '' },
            { path: 'tools/Dockerfile', name: 'Dockerfile', content: '' },
            { path: 'src/worker.py', name: 'worker.py', content: '' },
            { path: 'src/task.py', name: 'task.py', content: '' },
        ]

        expect(buildLanguageOverview(files)).toEqual([
            { language: 'TypeScript', files: 2, percentage: 33 },
            { language: 'Python', files: 2, percentage: 33 },
            { language: 'JavaScript', files: 1, percentage: 17 },
            { language: 'Dockerfile', files: 1, percentage: 17 },
        ])
    })

    test('formats idle, completed, and estimated sync progress', () => {
        const progress = { syncedFiles: 0, totalFiles: 3, currentPath: null }
        expect(formatEta(progress, null)).toBe('ETA calculating')
        expect(formatEta({ ...progress, syncedFiles: 3 }, 1000)).toBe('Done')

        Date.now = () => 11_000
        expect(formatEta({ ...progress, syncedFiles: 2 }, 1000)).toBe('5s left')
    })

    test('falls back for missing or invalid sync timestamps', () => {
        expect(formatSyncTime()).toBe('never')
        expect(formatSyncTime('not-a-date')).toBe('never')
    })

    test('status refresh preserves sync time while pull and push advance it', () => {
        const calls: unknown[] = []
        const stored = { input: 'org/repo', fullName: 'org/repo', branch: 'main', sourcePath: '', updatedAt: 'old-update', lastSyncedAt: 'old-sync' }
        const context = {
            shareRouteId: 'share-1', autoPullMinutes: 15, stored,
            setGitStatus: (status: AIGitStatus) => calls.push(status),
            setSelectedPaths: (paths: Set<string>) => calls.push(paths),
            setStatus: (message: string | null) => calls.push(message),
            setStored: (workspace: typeof stored) => calls.push(workspace),
        } as unknown as GitOperationContext
        const status = { branchSummary: 'main', files: [
            { path: 'src/app.ts', index: 'M', workingTree: ' ', selected: false },
            { path: 'README.md', index: ' ', workingTree: 'M', selected: false },
        ] }

        applyGitStatus(context, status, '2 changed files ready to stage.', 'status')

        expect(calls[0]).toBe(status)
        expect(calls[1]).toEqual(new Set(['src/app.ts', 'README.md']))
        expect(calls[2]).toMatchObject({ updatedAt: expect.any(String), lastSyncedAt: 'old-sync', autoPullMinutes: 15 })
        expect((calls[2] as typeof stored).updatedAt).not.toBe('old-update')
        expect(calls[3]).toBe('2 changed files ready to stage.')

        calls.length = 0
        applyGitStatus(context, status, 'Remote changes pulled into the Git worktree.', 'sync')
        const synced = calls[2] as typeof stored
        expect(synced).toMatchObject({ updatedAt: expect.any(String), lastSyncedAt: expect.any(String), autoPullMinutes: 15 })
        expect(synced.updatedAt).not.toBe('old-update')
        expect(synced.lastSyncedAt).not.toBe('old-sync')
        expect(calls[3]).toBe('Remote changes pulled into the Git worktree.')
    })

    test('renders the signed-out Git import and workspace controls', () => {
        const html = renderToStaticMarkup(createElement(GitPlugin, { shareRouteId: 'demo', share: null }))
        expect(html).toContain('Sign in for Git access')
        expect(html).toContain('owner/repo, GitHub URL, or public Git URL')
        expect(html).toContain('Auto pull')
        expect(html).toContain('Changes')
        expect(html).toContain('Commit and push')
        expect(html).toContain('disabled=""')
    })

    test('renders accessible metadata panel navigation controls', () => {
        const ignoreUpdate = () => undefined
        const html = renderToStaticMarkup(createElement(MetadataSidebar, {
            shareRouteId: 'demo', share: null, activePanel: 'workspace', onTogglePanel: ignoreUpdate,
            onClose: ignoreUpdate, onOpenBox: ignoreUpdate, editingContent: '', didCopy: false,
            setDidCopy: ignoreUpdate, setError: ignoreUpdate, setDisplayLineNumbers: ignoreUpdate,
            syntaxHighlighting: true, setSyntaxHighlighting: ignoreUpdate,
        }))
        for (const label of ['Workspace status', 'Share details', 'Terminal access', 'Symbols', 'Chat', 'Git plugin', 'Phone simulator']) {
            expect(html).toContain(`aria-label="${label}"`)
        }
        expect(html).toContain('aria-label="Reload current share workspace"')
        expect(html).toContain('aria-label="Toggle line numbers"')
    })
})

const originalNow = Date.now
