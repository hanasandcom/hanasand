import { expect, mock, test } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

mock.module('../src/constants.ts', () => ({ default: { articles_repo_url: 'unused-for-local-content' } }))

test('article saves publish to both mirrors, retry partial publishes, and preserve Git dates', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-ownership-articles-'))
    const previous = process.env.ARTICLES_REPO_PATH
    const envKeys = [
        'ARTICLES_GITHUB_PUSH_URL',
        'ARTICLES_FORGEJO_PUSH_URL',
        'ARTICLES_GITHUB_USERNAME',
        'ARTICLES_GITHUB_TOKEN',
        'ARTICLES_FORGEJO_USERNAME',
        'ARTICLES_FORGEJO_TOKEN',
    ] as const
    const previousValues = new Map(envKeys.map(key => [key, process.env[key]]))
    process.env.ARTICLES_REPO_PATH = directory

    try {
        execFileSync('git', ['init', '-q', '-b', 'main', directory])
        execFileSync('git', ['-C', directory, 'config', 'user.name', 'Content test'])
        execFileSync('git', ['-C', directory, 'config', 'user.email', 'content-test@example.test'])
        await mkdir(join(directory, 'articles'))
        const file = join(directory, 'articles', 'example.md')
        await writeFile(file, '# Original')
        execFileSync('git', ['-C', directory, 'add', 'articles'])
        execFileSync('git', ['-C', directory, 'commit', '-qm', 'Initial content'], { env: { ...process.env, GIT_AUTHOR_DATE: '2025-01-01T12:00:00Z', GIT_COMMITTER_DATE: '2025-01-01T12:00:00Z' } })

        const githubRemote = join(directory, 'github.git')
        const forgejoRemote = join(directory, 'forgejo.git')
        execFileSync('git', ['init', '-q', '--bare', githubRemote])
        execFileSync('git', ['init', '-q', '--bare', forgejoRemote])
        process.env.ARTICLES_GITHUB_PUSH_URL = pathToFileURL(githubRemote).href
        process.env.ARTICLES_FORGEJO_PUSH_URL = pathToFileURL(forgejoRemote).href
        for (const key of envKeys.slice(2)) delete process.env[key]

        const { ensureRepo, ARTICLES_DIR } = await import('../src/utils/git/git.ts')
        const { default: refresh } = await import('../src/utils/git/ensureRepositoryUpToDate.ts')
        const { default: save } = await import('../src/utils/git/commitAndPush.ts')
        const { default: createdAt } = await import('../src/utils/git/createdAt.ts')
        const { default: updatedAt } = await import('../src/utils/git/updatedAt.ts')
        await ensureRepo()
        await refresh()
        expect(ARTICLES_DIR).toBe(join(directory, 'articles'))
        expect(await createdAt(file)).toContain('2025-01-01')
        expect(await updatedAt(file)).toContain('2025-01-01')

        await writeFile(file, '# Updated')
        execFileSync('git', ['-C', directory, 'remote', 'add', 'origin', 'https://github.com/hanasandcom/articles.git'])
        await writeFile(join(directory, 'unrelated.md'), '# Keep staged')
        execFileSync('git', ['-C', directory, 'add', 'unrelated.md'])
        await save('Update article')
        const firstHead = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
        expect(execFileSync('git', ['--git-dir', githubRemote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()).toBe(firstHead)
        expect(execFileSync('git', ['--git-dir', forgejoRemote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()).toBe(firstHead)
        expect(execFileSync('git', ['-C', directory, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { encoding: 'utf8' }).trim()).toBe('articles/example.md')
        expect(execFileSync('git', ['-C', directory, 'diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim()).toBe('unrelated.md')

        await writeFile(file, '# Partial publish')
        process.env.ARTICLES_FORGEJO_PUSH_URL = pathToFileURL(join(directory, 'missing-forgejo.git')).href
        await expect(save('Update article before retry')).rejects.toThrow('publishing to GitHub and Forgejo failed')
        process.env.ARTICLES_FORGEJO_PUSH_URL = pathToFileURL(forgejoRemote).href
        await save('Retry partial publish')
        const retryHead = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
        expect(execFileSync('git', ['--git-dir', githubRemote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()).toBe(retryHead)
        expect(execFileSync('git', ['--git-dir', forgejoRemote, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim()).toBe(retryHead)
        await save('No duplicate empty commit')
        expect(execFileSync('git', ['-C', directory, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim()).toBe('3')
        expect(await createdAt(file)).toContain('2025-01-01')

        process.env.ARTICLES_GITHUB_PUSH_URL = 'https://test-user:test-token@github.com/hanasandcom/articles.git'
        const embeddedUrlError = await save('Reject embedded credentials').then(() => '', error => error instanceof Error ? error.message : String(error))
        expect(embeddedUrlError).toContain('credential-free URL')
        expect(embeddedUrlError).not.toContain('test-token')
        delete process.env.ARTICLES_GITHUB_PUSH_URL
        await expect(save('Require publishing credentials')).rejects.toThrow('missing for GitHub')
    } finally {
        if (previous === undefined) delete process.env.ARTICLES_REPO_PATH
        else process.env.ARTICLES_REPO_PATH = previous
        for (const key of envKeys) {
            const previousValue = previousValues.get(key)
            if (previousValue === undefined) delete process.env[key]
            else process.env[key] = previousValue
        }
        await rm(directory, { recursive: true, force: true })
    }
})
