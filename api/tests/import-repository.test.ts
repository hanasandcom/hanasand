import { expect, mock, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

let importUserId: string | null = null
let externalSecretPath = ''

mock.module('../src/handlers/ai/shared.ts', () => ({ requireAiUser: async () => importUserId }))
mock.module('../src/handlers/ai/gitCommand.ts', () => ({ runGit: runFakeGit }))
mock.module('#utils/ai/repoCredentials.ts', () => ({
    buildTokenHint: () => '',
    getRepoCredential: async () => null,
    touchRepoCredentialUsage: async () => {},
    toRepoCredentialSummary: () => ({}),
}))
mock.module('#utils/ai/stack.ts', () => ({ detectRepositoryStack: () => ({ stackType: 'unknown', reason: '' }) }))

const { default: importRepository, parseGitInput } = await import('../src/handlers/ai/importRepository.ts')

test('GitHub URLs and owner/repo input produce the same normalized repository details', () => {
    const fromUrl = parseGitInput('https://github.com/Owner/Project.git/tree/main/apps/web')
    const fromShortInput = parseGitInput('Owner/Project.git#main:apps/web')

    expect(fromUrl).toEqual(fromShortInput)
    expect(fromUrl).toMatchObject({
        host: 'github.com',
        owner: 'Owner',
        repo: 'Project',
        fullName: 'Owner/Project',
        repositoryUrl: 'https://github.com/Owner/Project.git',
        branch: 'main',
        sourcePath: 'apps/web',
        webBaseUrl: 'https://github.com/Owner/Project',
        isGitHub: true,
    })
})

test('repository import skips symlinks that resolve outside the clone', async () => {
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-import-test-'))
    externalSecretPath = path.join(outsideDir, 'secret.txt')
    await writeFile(externalSecretPath, 'external secret')
    importUserId = 'owner-1'

    try {
        const reply = {
            status() { return this },
            send: (body: unknown) => body,
        }
        const response = await importRepository(
            { body: { input: 'owner/repo' } } as never,
            reply as never,
        ) as { files: Array<{ path: string, name: string, content: string }> }

        expect(response.files).toEqual([
            { path: 'regular.txt', name: 'regular.txt', content: 'regular content' },
            { path: 'internal-link.txt', name: 'internal-link.txt', content: 'regular content' },
        ])
    } finally {
        importUserId = null
        externalSecretPath = ''
        await rm(outsideDir, { recursive: true, force: true })
    }
})

async function runFakeGit(args: string[]) {
    if (args[0] === 'ls-remote') {
        return { stdout: 'ref: refs/heads/main\tHEAD\n' }
    }

    if (args[0] === 'clone') {
        const cloneDir = args[args.length - 1]
        if (!cloneDir) {
            throw new Error('Fake clone command is missing its destination.')
        }
        await mkdir(cloneDir, { recursive: true })
        await writeFile(path.join(cloneDir, 'regular.txt'), 'regular content')
        await symlink('regular.txt', path.join(cloneDir, 'internal-link.txt'))
        await symlink(externalSecretPath, path.join(cloneDir, 'external-link.txt'))
        await symlink('missing.txt', path.join(cloneDir, 'dangling-link.txt'))
        return { stdout: '' }
    }

    if (args.includes('ls-files')) {
        return { stdout: 'regular.txt\ninternal-link.txt\nexternal-link.txt\ndangling-link.txt\n' }
    }

    throw new Error(`Unexpected fake git command: ${args.join(' ')}`)
}
