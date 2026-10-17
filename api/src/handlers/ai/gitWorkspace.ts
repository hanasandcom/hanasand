import type { FastifyReply, FastifyRequest } from 'fastify'
import { runGit } from './gitCommand.ts'
import { buildStatus, getRepository, loadWorkspace, prepareWorkspace, requireUser, assertSafeRelativePath } from './gitWorkspaceShared.ts'

export async function getGitWorkspaceStatus(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireUser(req, res)
    if (!userId) return

    const { id } = req.params as { id: string }
    const { shareId } = req.query as { shareId?: string }
    if (!id || !shareId) {
        return res.status(400).send({ error: 'Missing repository or share id.' })
    }

    try {
        const { workspacePath, gitEnv } = await loadWorkspace(id, shareId, userId)
        return res.send(await buildStatus(workspacePath, gitEnv))
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Failed to load Git status.' })
    }
}

export async function postGitWorkspacePull(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireUser(req, res)
    if (!userId) return

    const { id } = req.params as { id: string }
    const repository = await getRepository(id, userId)
    if (!repository) {
        return res.status(404).send({ error: 'Repository not found.' })
    }

    try {
        const { workspacePath, gitEnv } = await prepareWorkspace(repository, userId)
        await runGit(['-C', workspacePath, 'pull', '--rebase', 'origin', repository.branch], undefined, gitEnv)
        return res.send(await buildStatus(workspacePath, gitEnv))
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Failed to pull repository.' })
    }
}

export async function postGitWorkspaceCommit(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireUser(req, res)
    if (!userId) return

    const { id } = req.params as { id: string }
    const { shareId, message, paths } = req.body as { shareId?: string, message?: string, paths?: string[] } ?? {}
    const commitMessage = typeof message === 'string' ? message.trim() : ''
    const selectedPaths = Array.isArray(paths) ? paths.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim()) : []

    if (!id || !shareId) {
        return res.status(400).send({ error: 'Missing repository or share id.' })
    }
    if (!commitMessage) {
        return res.status(400).send({ error: 'Enter a commit message.' })
    }
    if (!selectedPaths.length) {
        return res.status(400).send({ error: 'Stage at least one file before committing.' })
    }

    try {
        selectedPaths.forEach(assertSafeRelativePath)
        const { workspacePath, gitEnv } = await loadWorkspace(id, shareId, userId)
        await runGit(['-C', workspacePath, 'add', '--', ...selectedPaths], undefined, gitEnv)
        await runGit(['-C', workspacePath, 'commit', '-m', commitMessage], undefined, gitEnv)
        const { stdout } = await runGit(['-C', workspacePath, 'rev-parse', '--short', 'HEAD'], undefined, gitEnv)
        return res.send({
            ok: true,
            commit: stdout.trim(),
            status: await buildStatus(workspacePath, gitEnv),
        })
    } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Failed to commit staged files.'
        return res.status(400).send({ error: messageText.includes('nothing to commit') ? 'Nothing changed in the staged files.' : messageText })
    }
}

export async function postGitWorkspacePush(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireUser(req, res)
    if (!userId) return

    const { id } = req.params as { id: string }
    const repository = await getRepository(id, userId)
    if (!repository) {
        return res.status(404).send({ error: 'Repository not found.' })
    }

    try {
        const { workspacePath, gitEnv } = await prepareWorkspace(repository, userId)
        await runGit(['-C', workspacePath, 'push', 'origin', `HEAD:${repository.branch}`], undefined, gitEnv)
        return res.send(await buildStatus(workspacePath, gitEnv))
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Failed to push repository.' })
    }
}
