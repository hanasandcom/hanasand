import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAiUser } from './shared.ts'
import { runGit } from './gitCommand.ts'
import { createGitAskPass } from './gitAskPass.ts'
import { parseGitInput } from './gitRepositoryInput.ts'
import { buildTokenHint, getRepoCredential, touchRepoCredentialUsage, toRepoCredentialSummary } from '#utils/ai/repoCredentials.ts'
import { detectRepositoryStack } from '#utils/ai/stack.ts'

export { parseGitInput } from './gitRepositoryInput.ts'

const MAX_FILES = 10_000
const MAX_FILE_SIZE = 250_000

function isWithinDirectory(root: string, target: string) {
    const relativePath = path.relative(root, target)
    return relativePath === ''
        || (relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath))
}

function buildGitEnv(token: string | undefined, askPassPath?: string) {
    if (!token || !askPassPath) {
        return {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
        }
    }

    return {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: askPassPath,
        HANASAND_GITHUB_TOKEN: token,
    }
}

async function resolveDefaultBranch(repositoryUrl: string, gitEnv?: NodeJS.ProcessEnv) {
    const { stdout } = await runGit(['ls-remote', '--symref', repositoryUrl, 'HEAD'], undefined, gitEnv)
    const match = stdout.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/)
    if (!match?.[1]) {
        throw new Error('Unable to determine the default branch for this repository.')
    }

    return match[1]
}

async function readRepositoryFiles(cloneDir: string, sourcePath: string, gitEnv: NodeJS.ProcessEnv) {
    const cloneRoot = await realpath(cloneDir)
    const { stdout } = await runGit(['-C', cloneDir, 'ls-files', '--', sourcePath || '.'], undefined, gitEnv)
    const filePaths = stdout
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, MAX_FILES)

    const files: AIImportedRepoFile[] = []
    for (const filePath of filePaths) {
        const fullPath = await realpath(path.join(cloneDir, filePath)).catch(() => null)
        if (!fullPath || !isWithinDirectory(cloneRoot, fullPath)) {
            continue
        }

        const content = await readFile(fullPath, 'utf8').catch(() => null)
        if (content === null || Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
            continue
        }

        files.push({
            path: filePath,
            name: path.basename(filePath),
            content,
        })
    }

    return { files, truncated: filePaths.length >= MAX_FILES }
}

export function describeImportError(error: unknown) {
    if (!(error instanceof Error)) {
        return { status: 502, message: 'Failed to import repository.' }
    }

    const message = error.message
    if (message.includes('Use a Git URL')) {
        return { status: 400, message }
    }

    if (
        message.includes('The requested URL returned error: 502')
        || message.includes('The requested URL returned error: 503')
        || message.includes('The requested URL returned error: 504')
        || message.includes('Could not resolve host')
        || message.includes('Failed to connect')
        || message.includes('Connection refused')
    ) {
        return { status: 503, message: 'Git server unavailable. Try again when the remote is reachable.' }
    }

    if (message.includes('Authentication failed') || message.includes('could not read Username') || message.includes('Could not read from remote repository')) {
        return { status: 401, message: 'Git authentication failed. Check the repository visibility or attach a valid token.' }
    }

    if (message.includes('Repository not found') || message.includes('not found')) {
        return { status: 404, message: 'Repository not found. Check the URL and repository visibility.' }
    }

    return { status: 502, message }
}

export default async function importRepository(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) return

    const { input, existingId, githubToken } = req.body as { input?: string, existingId?: string, githubToken?: string } ?? {}
    if (!input?.trim()) {
        return res.status(400).send({ error: 'Missing repository input.' })
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-import-'))

    try {
        const parsed = parseGitInput(input)
        const repositoryUrl = parsed.repositoryUrl
        const savedCredential = existingId ? await getRepoCredential(existingId, userId).catch(() => null) : null
        const token = parsed.isGitHub ? githubToken?.trim() || savedCredential?.token || '' : ''
        const askPassPath = token ? await createGitAskPass(tempDir, 'git-askpass.sh') : undefined
        const gitEnv = buildGitEnv(token || undefined, askPassPath)
        const defaultBranch = await resolveDefaultBranch(repositoryUrl, gitEnv)
        const branch = parsed.branch || defaultBranch
        const cloneDir = path.join(tempDir, parsed.repo)

        await runGit(['clone', '--depth', '1', '--branch', branch, repositoryUrl, cloneDir], undefined, gitEnv)
        const { files, truncated } = await readRepositoryFiles(cloneDir, parsed.sourcePath, gitEnv)

        const { stackType, reason: stackReason } = detectRepositoryStack(files)
        const stackSupported = stackType !== 'unknown'
        const usedToken = Boolean(token)
        if (usedToken && existingId && savedCredential) {
            await touchRepoCredentialUsage(existingId, userId, true).catch(() => undefined)
        }
        const sourceUrl = parsed.webBaseUrl
            ? parsed.sourcePath
                ? `${parsed.webBaseUrl}/tree/${branch}/${parsed.sourcePath}`
                : `${parsed.webBaseUrl}/tree/${branch}`
            : repositoryUrl

        return res.send({
            id: existingId || crypto.randomUUID(),
            ownerId: userId,
            accessScope: 'owned',
            name: parsed.repo,
            fullName: parsed.fullName,
            branch,
            defaultBranch,
            sourcePath: parsed.sourcePath,
            sourceUrl,
            authMode: usedToken ? 'github_token' : 'public',
            authHint: savedCredential?.summary?.hasCredential
                ? `Private GitHub access is stored server-side ${savedCredential.summary.tokenHint || ''}.`
                : usedToken
                    ? 'Private GitHub access succeeded. Save the token to the repository if you want future refreshes without re-entering it.'
                    : null,
            syncStatus: 'syncing',
            lastSyncedAt: null,
            lastSyncError: null,
            syncHistory: [{
                timestamp: new Date().toISOString(),
                status: 'syncing',
                source: existingId ? 'refresh' : 'import',
                message: existingId
                    ? `Repository content fetched${usedToken ? ' with one-time token auth' : ''}. Syncing into the editor workspace...`
                    : `Repository fetched${usedToken ? ' with one-time token auth' : ''}. Preparing the editor workspace...`,
            }],
            stackType,
            stackReason,
            stackSupported,
            credential: savedCredential?.summary || toRepoCredentialSummary({
                github_token_encrypted: usedToken ? 'attached' : null,
                github_token_hint: usedToken ? buildTokenHint(token) : null,
                github_token_attached_at: savedCredential?.summary.attachedAt || null,
                github_token_last_used_at: usedToken ? new Date().toISOString() : savedCredential?.summary.lastUsedAt || null,
                github_token_last_validated_at: usedToken ? new Date().toISOString() : savedCredential?.summary.lastValidatedAt || null,
            }),
            files,
            truncated,
            importedAt: new Date().toISOString(),
        } satisfies AIImportedRepo)
    } catch (error) {
        const { status, message } = describeImportError(error)
        return res.status(status).send({ error: message })
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
}
