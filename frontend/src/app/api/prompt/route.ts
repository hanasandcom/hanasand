import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { comparePromptItems } from '@/utils/promptPortal/ordering'
import requirePromptPortalSession from '@/utils/promptPortal/sessionAccess'
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

export async function GET(request: NextRequest) {
    const access = await requirePromptPortalSession(request)
    if ('response' in access) return access.response
    const state = await readPromptPortalState()
    const conversationId = request.nextUrl.searchParams.get('conversationId') || 'default'
    return NextResponse.json(publicPromptPortalState({ ...state, items: state.items.filter(item => !item.conversationId || item.conversationId === conversationId) }), { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
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
    const prompt = String(form.get('prompt') || '').trim().slice(0, MAX_PROMPT_LENGTH)
    if (!prompt) {
        return NextResponse.json({ ok: false, error: 'Prompt is required.' }, { status: 400 })
    }

    const files: Awaited<ReturnType<typeof savePromptPortalFile>>[] = []
    for (const value of form.getAll('files').slice(0, MAX_FILES)) {
        if (value instanceof File && value.size > 0) files.push(await savePromptPortalFile(value))
    }

    state.items.push({
        id: randomBytes(10).toString('hex'),
        conversationId,
        prompt,
        files,
        priority: form.get('priority') === 'now' ? 'now' : 'next',
        status: 'queued',
        createdAt: new Date().toISOString(),
    })
    await writePromptPortalState(state)
    return NextResponse.json({ ok: true, ...publicPromptPortalState({ ...state, items: state.items.filter(item => item.conversationId === conversationId) }) }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

async function mutateQueuedPrompt(body: Record<string, unknown>, action: 'edit' | 'delete' | 'reorder') {
    const state = await readPromptPortalState()
    const conversationId = String(body.conversationId || '').trim()
    if (!/^[a-z0-9-]{1,100}$/i.test(conversationId)) return NextResponse.json({ ok: false, error: 'Choose a valid conversation.' }, { status: 400 })
    const item = state.items.find(candidate => candidate.id === body.id && (!candidate.conversationId || candidate.conversationId === conversationId) && candidate.status === 'queued')
    if (!item) return NextResponse.json({ ok: false, error: 'Queued instruction not found.' }, { status: 404 })
    item.conversationId = conversationId

    if (action === 'edit') {
        const prompt = String(body.prompt || '').trim().slice(0, MAX_PROMPT_LENGTH)
        if (!prompt) return NextResponse.json({ ok: false, error: 'Prompt is required.' }, { status: 400 })
        item.prompt = prompt
    } else if (action === 'delete') {
        state.items = state.items.filter(candidate => candidate.id !== item.id)
    } else {
        const queued = state.items.filter(candidate => candidate.status === 'queued').sort(comparePromptItems)
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
    return NextResponse.json({ ok: true, ...publicPromptPortalState({ ...state, items: state.items.filter(candidate => candidate.conversationId === conversationId) }) }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}
