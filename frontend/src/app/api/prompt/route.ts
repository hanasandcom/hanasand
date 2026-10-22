import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { PromptPortalContextMessage } from '@/utils/promptPortal/store'
import { comparePromptItems } from '@/utils/promptPortal/ordering'
import requirePromptPortalSession from '@/utils/promptPortal/sessionAccess'
import { promptThreadId } from '@/utils/promptPortal/threadId'
import {
    publicPromptPortalState,
    readPromptPortalState,
    savePromptPortalFile,
    writePromptPortalState,
} from '@/utils/promptPortal/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PROMPT_LENGTH = 6000
const MAX_FILES = 3
const MAX_CONTEXT_BYTES = 1_000_000
const MAX_CONTEXT_MESSAGES = 500

export async function GET(request: NextRequest) {
    const access = await requirePromptPortalSession(request)
    if ('response' in access) return access.response
    const state = await readPromptPortalState()
    const conversationId = request.nextUrl.searchParams.get('conversationId') || 'default'
    const threadId = request.nextUrl.searchParams.get('threadId')
    const items = threadId
        ? state.items.filter(item => item.threadId ? item.threadId === threadId : item.conversationId === conversationId)
        : state.items.filter(item => !item.conversationId || item.conversationId === conversationId)
    return NextResponse.json(publicPromptPortalState({ ...state, items }), { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

export async function POST(request: NextRequest) {
    const access = await requirePromptPortalSession(request)
    if ('response' in access) return access.response
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) return enqueuePrompt(request)

    const body = await request.json().catch(() => null)
    if (body?.action === 'edit') return mutateQueuedPrompt(body, 'edit')
    if (body?.action === 'delete') return mutateQueuedPrompt(body, 'delete')
    if (body?.action === 'reorder') return mutateQueuedPrompt(body, 'reorder')
    return NextResponse.json({ ok: false, error: 'Unsupported prompt portal action.' }, { status: 400 })
}

async function enqueuePrompt(request: NextRequest) {
    const state = await readPromptPortalState()
    const form = await request.formData()
    const conversationId = String(form.get('conversationId') || '').trim()
    if (!/^[a-z0-9-]{1,100}$/i.test(conversationId)) return NextResponse.json({ ok: false, error: 'Choose a valid conversation.' }, { status: 400 })
    const threadId = String(form.get('threadId') || '').trim()
    if (threadId !== promptThreadId(conversationId)) return NextResponse.json({ ok: false, error: 'Choose a valid ChatGPT thread for this conversation.' }, { status: 400 })
    const prompt = String(form.get('prompt') || '').trim().slice(0, MAX_PROMPT_LENGTH)
    if (!prompt) {
        return NextResponse.json({ ok: false, error: 'Prompt is required.' }, { status: 400 })
    }

    const contextResult = parsePromptContext(String(form.get('context') || '[]'))
    if ('error' in contextResult) return NextResponse.json({ ok: false, error: contextResult.error }, { status: contextResult.status })

    const files: Awaited<ReturnType<typeof savePromptPortalFile>>[] = []
    for (const value of form.getAll('files').slice(0, MAX_FILES)) {
        if (value instanceof File && value.size > 0) files.push(await savePromptPortalFile(value))
    }

    state.items.push({
        id: randomBytes(10).toString('hex'),
        conversationId,
        threadId,
        context: contextResult.context,
        prompt,
        files,
        priority: form.get('priority') === 'now' ? 'now' : 'next',
        status: 'queued',
        createdAt: new Date().toISOString(),
    })
    await writePromptPortalState(state)
    return NextResponse.json({ ok: true, ...publicPromptPortalState({ ...state, items: state.items.filter(item => item.threadId === threadId) }) }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

function parsePromptContext(raw: string): { context: PromptPortalContextMessage[] } | { error: string, status: number } {
    if (Buffer.byteLength(raw, 'utf8') > MAX_CONTEXT_BYTES) return { error: 'This conversation is too large to send as model context.', status: 413 }
    let value: unknown
    try { value = JSON.parse(raw) } catch { return { error: 'Conversation context must be valid JSON.', status: 400 } }
    if (!Array.isArray(value) || value.length > MAX_CONTEXT_MESSAGES) return { error: `Conversation context can contain at most ${MAX_CONTEXT_MESSAGES} messages.`, status: 413 }
    const context: PromptPortalContextMessage[] = []
    for (const candidate of value) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
            return { error: 'Conversation context contains an invalid message.', status: 400 }
        }
        const message = candidate as Record<string, unknown>
        if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return { error: 'Conversation context contains an invalid message.', status: 400 }
        const itemId = (file: unknown) => file && typeof file === 'object' && typeof (file as { itemId?: unknown }).itemId === 'string' && typeof (file as { fileId?: unknown }).fileId === 'string'
            ? { itemId: (file as { itemId: string }).itemId, fileId: (file as { fileId: string }).fileId }
            : null
        const files = Array.isArray(message.files) ? message.files.slice(0, 12).map(itemId).filter((file): file is { itemId: string, fileId: string } => file !== null) : undefined
        context.push({
            role: message.role,
            content: message.content,
            ...(typeof message.modelName === 'string' ? { modelName: message.modelName.slice(0, 120) } : {}),
            ...(files?.length ? { files } : {}),
        })
    }
    return { context }
}

async function mutateQueuedPrompt(body: Record<string, unknown>, action: 'edit' | 'delete' | 'reorder') {
    const state = await readPromptPortalState()
    const conversationId = String(body.conversationId || '').trim()
    if (!/^[a-z0-9-]{1,100}$/i.test(conversationId)) return NextResponse.json({ ok: false, error: 'Choose a valid conversation.' }, { status: 400 })
    const threadId = String(body.threadId || '').trim()
    if (threadId !== promptThreadId(conversationId)) return NextResponse.json({ ok: false, error: 'Choose a valid ChatGPT thread for this conversation.' }, { status: 400 })
    const item = state.items.find(candidate => candidate.id === body.id && (candidate.threadId ? candidate.threadId === threadId : candidate.conversationId === conversationId) && candidate.status === 'queued')
    if (!item) return NextResponse.json({ ok: false, error: 'Queued instruction not found.' }, { status: 404 })
    item.conversationId = conversationId
    item.threadId = threadId

    if (action === 'edit') {
        const prompt = String(body.prompt || '').trim().slice(0, MAX_PROMPT_LENGTH)
        if (!prompt) return NextResponse.json({ ok: false, error: 'Prompt is required.' }, { status: 400 })
        item.prompt = prompt
    } else if (action === 'delete') {
        state.items = state.items.filter(candidate => candidate.id !== item.id)
    } else {
        const queued = state.items.filter(candidate => candidate.status === 'queued' && (candidate.threadId === threadId || (!candidate.threadId && candidate.conversationId === conversationId))).sort(comparePromptItems)
        const index = queued.findIndex(candidate => candidate.id === item.id)
        const target = queued[index + (body.direction === 'down' ? 1 : -1)]
        if (target) {
            const priority = item.priority
            const createdAt = item.createdAt
            item.priority = target.priority
            item.createdAt = target.createdAt
            target.createdAt = createdAt
            target.priority = priority
        }
    }

    await writePromptPortalState(state)
    return NextResponse.json({ ok: true, ...publicPromptPortalState({ ...state, items: state.items.filter(candidate => candidate.threadId === threadId) }) }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}
