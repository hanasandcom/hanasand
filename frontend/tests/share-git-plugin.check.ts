import { afterEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import GitPlugin from '../src/components/share/gitPlugin'
import { buildLanguageOverview, formatEta, formatSyncTime } from '../src/components/share/gitPlugin/storage'

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

    test('renders the signed-out Git import and workspace controls', () => {
        const html = renderToStaticMarkup(createElement(GitPlugin, { shareRouteId: 'demo', share: null }))
        expect(html).toContain('Sign in for Git access')
        expect(html).toContain('owner/repo, GitHub URL, or public Git URL')
        expect(html).toContain('Auto pull')
        expect(html).toContain('Changes')
        expect(html).toContain('Commit and push')
        expect(html).toContain('disabled=""')
    })
})

const originalNow = Date.now
