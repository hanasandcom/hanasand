import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { getRepoCredential } from '#utils/ai/repoCredentials.ts'
import { parseGitInput } from './gitRepositoryInput.ts'
import { runGit } from './gitCommand.ts'
import { createGitAskPass } from './gitAskPass.ts'
import { requireAiUser } from './shared.ts'

export type RepositoryRow = {
    id: string
    owner_id: string
    name: string
    full_name: string
    branch: string
    source_url: string
    source_path: string
}

type ShareFileRow = {
    id: string
    name: string
    type: string
    content: string | null
    file_path: string
}

const workspaceRoot = path.join(os.tmpdir(), 'hanasand-git-workspaces')

export async function getRepository(repositoryId: string, userId: string) {
    const result = await run(`
        SELECT id, owner_id, name, full_name, branch, source_url, source_path
        FROM ai_imported_repositories
        WHERE id = $1
          AND owner_id = $2
    `, [repositoryId, userId])

    return (result.rows as RepositoryRow[])[0] || null
}

async function getShareFiles(shareId: string, userId: string) {
    const result = await run(`
        WITH RECURSIVE tree AS (
            SELECT id, name, parent, type, content, ''::text AS file_path, owner
            FROM share
            WHERE id = $1
              AND owner = $2
            UNION ALL
            SELECT child.id,
                   child.name,
                   child.parent,
                   child.type,
                   child.content,
                   CASE
                       WHEN tree.file_path = '' THEN child.name
                       ELSE tree.file_path || '/' || child.name
                   END AS file_path,
                   child.owner
            FROM share AS child
            JOIN tree
              ON child.parent = tree.id
        )
        SELECT id, name, type, content, file_path
        FROM tree
        WHERE type = 'file'
          AND file_path <> ''
        ORDER BY file_path ASC
    `, [shareId, userId])

    return result.rows as ShareFileRow[]
}

function workspacePathFor(userId: string, repositoryId: string) {
    return path.join(workspaceRoot, userId.replace(/[^a-zA-Z0-9_-]/g, '_'), repositoryId.replace(/[^a-zA-Z0-9_-]/g, '_'))
}

async function pathExists(filePath: string) {
    return stat(filePath).then(() => true).catch(() => false)
}

export async function prepareWorkspace(repository: RepositoryRow, userId: string) {
    const parsed = parseGitInput(repository.source_url || repository.full_name)
    const workspacePath = workspacePathFor(userId, repository.id)
    const parentPath = path.dirname(workspacePath)
    await mkdir(parentPath, { recursive: true })

    const credential = parsed.isGitHub ? await getRepoCredential(repository.id, userId).catch(() => null) : null
    const askPassPath = credential?.token ? await createGitAskPass(parentPath, '.hanasand-git-askpass.sh') : null
    const gitEnv = askPassPath && credential?.token ? { GIT_ASKPASS: askPassPath, HANASAND_GITHUB_TOKEN: credential.token } : undefined

    if (!await pathExists(path.join(workspacePath, '.git'))) {
        await rm(workspacePath, { recursive: true, force: true })
        await runGit(['clone', parsed.repositoryUrl, workspacePath], undefined, gitEnv)
    }

    await runGit(['-C', workspacePath, 'remote', 'set-url', 'origin', parsed.repositoryUrl], undefined, gitEnv)
    await runGit(['-C', workspacePath, 'config', 'user.name', 'Hanasand'], undefined, gitEnv)
    await runGit(['-C', workspacePath, 'config', 'user.email', 'git@hanasand.com'], undefined, gitEnv)
    await runGit(['-C', workspacePath, 'checkout', repository.branch], undefined, gitEnv)
        .catch(() => runGit(['-C', workspacePath, 'checkout', '-b', repository.branch, `origin/${repository.branch}`], undefined, gitEnv))

    return { workspacePath, gitEnv }
}

export function assertSafeRelativePath(filePath: string) {
    if (!filePath || path.isAbsolute(filePath) || filePath.split('/').includes('..')) {
        throw new Error(`Unsafe file path: ${filePath}`)
    }
}

async function overlayShareFiles(workspacePath: string, files: ShareFileRow[]) {
    for (const file of files) {
        const fullPath = path.join(workspacePath, file.file_path)
        await mkdir(path.dirname(fullPath), { recursive: true })
        await writeFile(fullPath, file.content || '', 'utf8')
    }
}

export async function loadWorkspace(repositoryId: string, shareId: string, userId: string) {
    const repository = await getRepository(repositoryId, userId)
    if (!repository) {
        throw new Error('Repository not found.')
    }

    const files = await getShareFiles(shareId, userId)
    files.forEach((file) => assertSafeRelativePath(file.file_path))
    const { workspacePath, gitEnv } = await prepareWorkspace(repository, userId)
    await overlayShareFiles(workspacePath, files)
    return { repository, files, workspacePath, gitEnv }
}

function parsePorcelain(stdout: string): AIGitStatusFile[] {
    return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            const rawPath = line.slice(3)
            const renamePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath
            return {
                path: renamePath.trim(),
                index: line[0] || ' ',
                workingTree: line[1] || ' ',
                selected: false,
            }
        })
}

export async function buildStatus(workspacePath: string, gitEnv?: NodeJS.ProcessEnv) {
    const [{ stdout: statusOut }, { stdout: branchOut }] = await Promise.all([
        runGit(['-C', workspacePath, 'status', '--porcelain'], undefined, gitEnv),
        runGit(['-C', workspacePath, 'status', '--short', '--branch'], undefined, gitEnv),
    ])

    return {
        files: parsePorcelain(statusOut),
        branchSummary: branchOut.split('\n')[0]?.replace(/^##\s*/, '') || null,
    }
}

export async function requireUser(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) return null

    return userId
}
