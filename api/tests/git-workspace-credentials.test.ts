import { expect, mock, test } from 'bun:test'
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const ownerId = `git-workspace-test-${crypto.randomUUID()}`
const repositoryId = crypto.randomUUID()
const token = 'private-workspace-token'
let observedGitAuth: { args: string[], askPassPath: string, script: string, mode: number, token: string | undefined, prompt: string | undefined } | null = null

mock.module('#db', () => ({
    default: async (sql: string) => {
        if (sql.includes('FROM ai_imported_repositories')) {
            return { rows: [{
                id: repositoryId,
                owner_id: ownerId,
                name: 'repo',
                full_name: 'owner/repo',
                branch: 'main',
                source_url: 'https://github.com/owner/repo.git',
                source_path: '',
            }] }
        }
        if (sql.includes('WITH RECURSIVE tree AS')) return { rows: [] }
        throw new Error(`Unexpected database query: ${sql}`)
    },
}))
mock.module('#utils/ai/repoCredentials.ts', () => ({
    buildTokenHint: () => '',
    getRepoCredential: async () => ({ token }),
    touchRepoCredentialUsage: async () => {},
    toRepoCredentialSummary: () => ({}),
}))
mock.module('../src/handlers/ai/shared.ts', () => ({
    requireAiUser: async () => ownerId,
}))
mock.module('../src/handlers/ai/gitCommand.ts', () => ({ runGit: runFakeGit }))

const { getGitWorkspaceStatus } = await import('../src/handlers/ai/gitWorkspace.ts')

test('Git workspace passes its private ask-pass path and token to Git without writing the token into the script', async () => {
    const workspaceParent = path.join(os.tmpdir(), 'hanasand-git-workspaces', ownerId)
    observedGitAuth = null

    try {
        const reply = {
            status() { return this },
            send(body: unknown) { return body },
        }
        const response = await getGitWorkspaceStatus(
            { params: { id: repositoryId }, query: { shareId: 'share-1' } } as never,
            reply as never,
        )

        expect(response).toEqual({ files: [], branchSummary: 'main' })
        expect(observedGitAuth).not.toBeNull()
        expect(observedGitAuth).toMatchObject({
            askPassPath: path.join(workspaceParent, '.hanasand-git-askpass.sh'),
            token,
            mode: 0o700,
        })
        expect(observedGitAuth?.script).toContain('$HANASAND_GITHUB_TOKEN')
        expect(observedGitAuth?.script).not.toContain(token)
    } finally {
        observedGitAuth = null
        await rm(workspaceParent, { recursive: true, force: true })
    }
})

async function runFakeGit(args: string[], _cwd?: string, env?: NodeJS.ProcessEnv) {
    if (args[0] === 'clone') {
        const workspacePath = args.at(-1)
        if (!workspacePath) throw new Error('Git clone workspace path is missing.')
        await mkdir(path.join(workspacePath, '.git'), { recursive: true })
    }

    if (env?.GIT_ASKPASS) {
        const [script, scriptStats] = await Promise.all([
            readFile(env.GIT_ASKPASS, 'utf8'),
            stat(env.GIT_ASKPASS),
        ])
        observedGitAuth = {
            args,
            askPassPath: env.GIT_ASKPASS,
            script,
            mode: scriptStats.mode & 0o777,
            token: env.HANASAND_GITHUB_TOKEN,
            prompt: env.GIT_TERMINAL_PROMPT,
        }
    }

    if (args.includes('status')) {
        return { stdout: args.includes('--porcelain') ? '' : '## main' }
    }
    return { stdout: '' }
}
