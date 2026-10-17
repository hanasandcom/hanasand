// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { withFocusedWorkspaceFile } from '../src/components/ai/workbench/repositoryModel'

test('focused file metadata records repository and share selections consistently', () => {
    const metadata = { repositoryId: 'repo-1', selectedFilePath: 'old.ts', recentPaths: ['new.ts', 'old.ts'], retained: true }
    const repo = withFocusedWorkspaceFile(metadata, 'src/app.ts', 'Focused repository file')
    const share = withFocusedWorkspaceFile(metadata, 'docs/readme.md', 'Focused share file')

    expect(repo).toMatchObject({
        repositoryId: 'repo-1', selectedFilePath: 'src/app.ts', recentPaths: ['src/app.ts', 'new.ts', 'old.ts'],
        lastChangedPath: 'src/app.ts', lastWorkspaceAction: 'Focused repository file', retained: true,
    })
    expect(share).toMatchObject({
        repositoryId: 'repo-1', selectedFilePath: 'docs/readme.md', recentPaths: ['docs/readme.md', 'new.ts', 'old.ts'],
        lastChangedPath: 'docs/readme.md', lastWorkspaceAction: 'Focused share file', retained: true,
    })
})
