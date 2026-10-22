import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MAX_ITEMS = 80
const MAX_FILE_BYTES = 2 * 1024 * 1024

export type PromptPortalFile = {
    id: string
    name: string
    type: string
    size: number
    path: string
}

export type PromptPortalContextMessage = {
    role: 'user' | 'assistant'
    content: string
    modelName?: string
    files?: Array<{ itemId: string, fileId: string }>
}

export type PromptPortalItem = {
    id: string
    conversationId?: string
    threadId?: string
    context?: PromptPortalContextMessage[]
    prompt: string
    priority: 'now' | 'next'
    status: 'queued' | 'running' | 'done' | 'error'
    createdAt: string
    startedAt?: string
    completedAt?: string
    result?: string
    files: PromptPortalFile[]
}

export type PromptPortalState = {
    items: PromptPortalItem[]
}

export type PromptPortalPublicState = {
    items: PromptPortalItem[]
}

const emptyState: PromptPortalState = {
    items: [],
}

export function verifyWorkerToken(value: string | null, env: Record<string, string | undefined> = process.env) {
    if (!value) return false
    const left = Buffer.from(value)
    return [env.PROMPT_PORTAL_WORKER_TOKEN, env.PROMPT_PORTAL_WORKER_TOKEN_PREVIOUS]
        .map(expected => expected?.trim())
        .filter((expected): expected is string => Boolean(expected))
        .some(expected => {
            const right = Buffer.from(expected)
            return left.length === right.length && timingSafeEqual(left, right)
        })
}

export function publicPromptPortalState(state: PromptPortalState): PromptPortalPublicState {
    return {
        items: [...state.items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    }
}

export async function readPromptPortalState() {
    try {
        const stored = JSON.parse(await readFile(statePath(), 'utf8')) as Partial<PromptPortalState>
        return {
            items: Array.isArray(stored.items) ? stored.items : [],
        }
    } catch {
        return { ...emptyState, items: [] }
    }
}

export async function writePromptPortalState(state: PromptPortalState) {
    await mkdir(promptPortalDir(), { recursive: true })
    const file = statePath()
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    const next: PromptPortalState = {
        items: state.items.slice(-MAX_ITEMS),
    }
    // ponytail: single-user portal; replace this with a lock if multiple writers start racing.
    await writeFile(tmp, JSON.stringify(next, null, 2))
    await rename(tmp, file)
}

export async function savePromptPortalFile(file: File): Promise<PromptPortalFile> {
    if (!file.type.startsWith('image/')) throw new Error('Only image uploads are accepted.')
    if (file.size > MAX_FILE_BYTES) throw new Error('Images must be 2 MB or smaller.')
    const id = randomBytes(12).toString('hex')
    const extension = path.extname(file.name).replace(/[^.\w-]/g, '').slice(0, 12)
    const name = `${id}${extension || '.img'}`
    const relativePath = `files/${name}`
    const absolutePath = path.join(promptPortalDir(), relativePath)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()))
    return {
        id,
        name: file.name.slice(0, 120) || name,
        type: file.type,
        size: file.size,
        path: relativePath,
    }
}

export async function readPromptPortalFile(filePath: string) {
    const root = path.resolve(promptPortalDir())
    const absolutePath = path.resolve(root, filePath)
    if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new Error('Invalid file path.')
    return readFile(absolutePath)
}

export function promptPortalWorkerToken(env: Record<string, string | undefined> = process.env) {
    return env.PROMPT_PORTAL_WORKER_TOKEN?.trim() || ''
}

function promptPortalDir(env: Record<string, string | undefined> = process.env) {
    return env.PROMPT_PORTAL_STATE_DIR || '/var/lib/hanasand-prompt'
}

function statePath() {
    return path.join(promptPortalDir(), 'state.json')
}
