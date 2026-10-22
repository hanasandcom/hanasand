import { NextRequest, NextResponse } from 'next/server'
import type { PromptPortalItem } from '@/utils/promptPortal/store'
import { comparePromptItems } from '@/utils/promptPortal/ordering'
import { promptThreadId } from '@/utils/promptPortal/threadId'
import {
    promptPortalWorkerToken,
    readPromptPortalState,
    verifyWorkerToken,
    writePromptPortalState,
} from '@/utils/promptPortal/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const state = await readPromptPortalState()
    const queued = state.items
        .filter(candidate => candidate.status === 'queued')
        .sort(comparePromptItems)
    const first = queued[0]
    const threadId = first ? itemThreadId(first) : ''
    const batch = first ? [first] : []

    if (!batch.length) return NextResponse.json({ ok: true, readOnly: false, item: null })

    const startedAt = new Date().toISOString()
    batch.forEach(item => {
        item.status = 'running'
        item.startedAt = startedAt
    })
    await writePromptPortalState(state)

    const token = promptPortalWorkerToken()
    const files = batch.flatMap(item => item.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: new URL(`/api/prompt/file?itemId=${encodeURIComponent(item.id)}&fileId=${encodeURIComponent(file.id)}&token=${encodeURIComponent(token)}`, request.url).toString(),
    })))
    const selected = batch.length === 1 ? batch[0] : batchItem(batch)
    const context = resolveContextFiles(selected.context || [], state.items, threadId, request, token)
    const item = { ...selected, threadId, context, files }

    return NextResponse.json({
        ok: true,
        readOnly: false,
        threadId,
        item,
        instructions: 'Use item.context as the full prior conversation history. Execute the prompt using that context, then post {action:"complete",id,threadId,status,result} to this endpoint. Use the returned threadId exactly. Do not combine different threads or answer in Codex chat.',
    })
}

export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (body?.action !== 'complete') {
        return NextResponse.json({ ok: false, error: 'Unsupported worker action.' }, { status: 400 })
    }

    const state = await readPromptPortalState()
    const ids = String(body.id || '').split(',').filter(Boolean)
    const threadId = String(body.threadId || '')
    if (!/^chatgpt-[a-z0-9-]{1,100}$/i.test(threadId)) return NextResponse.json({ ok: false, error: 'A valid threadId is required.' }, { status: 400 })
    const requested = state.items.filter(candidate => ids.includes(candidate.id))
    if (!requested.length || requested.length !== ids.length) return NextResponse.json({ ok: false, error: 'Prompt item not found.' }, { status: 404 })
    if (requested.some(candidate => itemThreadId(candidate) !== threadId)) return NextResponse.json({ ok: false, error: 'threadId does not match the queued prompt.' }, { status: 409 })
    const items = requested

    const completedAt = new Date().toISOString()
    items.forEach(item => {
        item.status = body.status === 'error' ? 'error' : 'done'
        item.completedAt = completedAt
        item.result = String(body.result || '').slice(0, 20000)
    })
    await writePromptPortalState(state)
    return NextResponse.json({ ok: true, readOnly: false, item: items.length === 1 ? items[0] : batchItem(items) })
}

function authorized(request: NextRequest) {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
    return verifyWorkerToken(bearer || request.nextUrl.searchParams.get('token'))
}

function batchItem(items: PromptPortalItem[]): PromptPortalItem {
    return {
        ...items[0],
        threadId: itemThreadId(items[0]),
        id: items.map(item => item.id).join(','),
        prompt: [
            'Execute these queued instructions in priority order. Later high-priority items have already been moved up.',
            ...items.map((item, index) => `${index + 1}. ${item.prompt}`),
        ].join('\n\n'),
        files: items.flatMap(item => item.files),
    }
}

function itemThreadId(item: PromptPortalItem) {
    return item.threadId || promptThreadId(item.conversationId || 'default')
}

function resolveContextFiles(context: NonNullable<PromptPortalItem['context']>, items: PromptPortalItem[], threadId: string, request: NextRequest, token: string) {
    return context.map(message => ({
        ...message,
        files: message.files?.flatMap(reference => {
            const item = items.find(candidate => candidate.id === reference.itemId && itemThreadId(candidate) === threadId)
            const file = item?.files.find(candidate => candidate.id === reference.fileId)
            return item && file ? [{
                id: file.id,
                name: file.name,
                type: file.type,
                size: file.size,
                url: new URL(`/api/prompt/file?itemId=${encodeURIComponent(item.id)}&fileId=${encodeURIComponent(file.id)}&token=${encodeURIComponent(token)}`, request.url).toString(),
            }] : []
        }),
    }))
}
