import { afterAll, expect, mock, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import type { PromptPortalItem, PromptPortalState } from '../src/utils/promptPortal/store'
import { comparePromptItems } from '../src/utils/promptPortal/ordering'

const previousStateDir = process.env.PROMPT_PORTAL_STATE_DIR
const previousWorkerToken = process.env.PROMPT_PORTAL_WORKER_TOKEN
const stateDir = await mkdtemp(join(tmpdir(), 'prompt-portal-ordering-'))
process.env.PROMPT_PORTAL_STATE_DIR = stateDir
process.env.PROMPT_PORTAL_WORKER_TOKEN = 'worker-test-token'
mock.module('../src/utils/proxy/requireApiSession', () => ({
    default: async () => ({ identity: { id: 'user-1', token: 'session-token' } }),
}))
mock.module('../src/utils/organizations/hanasandMembership', () => ({
    isHanasandOrganizationMember: async () => true,
}))

const { POST } = await import('../src/app/api/prompt/route')
const { GET: workerGet } = await import('../src/app/api/prompt/worker/route')

afterAll(async () => {
    await rm(stateDir, { recursive: true, force: true })
    if (previousStateDir === undefined) delete process.env.PROMPT_PORTAL_STATE_DIR
    else process.env.PROMPT_PORTAL_STATE_DIR = previousStateDir
    if (previousWorkerToken === undefined) delete process.env.PROMPT_PORTAL_WORKER_TOKEN
    else process.env.PROMPT_PORTAL_WORKER_TOKEN = previousWorkerToken
})

function item(id: string, prompt: string, priority: PromptPortalItem['priority'], createdAt: string): PromptPortalItem {
    return { id, prompt, priority, status: 'queued', createdAt, files: [] }
}

test('prompt queue ordering is priority-first and FIFO within priority', () => {
    const items = [
        item('next-new', 'next created later', 'next', '2026-01-03T00:00:00Z'),
        item('now-new', 'now created later', 'now', '2026-01-02T00:00:00Z'),
        item('now-old', 'now created first', 'now', '2026-01-01T00:00:00Z'),
    ]
    expect([...items].sort(comparePromptItems).map(entry => entry.id)).toEqual(['now-old', 'now-new', 'next-new'])
})

test('shared ChatGPT conversation UI keeps attachments, priority, and queued request actions', async () => {
    const composer = await readFile(new URL('../src/components/ai/chat/chatComposer.tsx', import.meta.url), 'utf8')
    const transcript = await readFile(new URL('../src/components/ai/chat/chatTranscript.tsx', import.meta.url), 'utf8')
    expect(composer).toContain('provider === \'chatgpt\'')
    expect(composer).toContain('accept=\'image/*\' multiple')
    expect(composer).toContain('onPromptPriorityChange(\'now\')')
    expect(transcript).toContain('onEditPrompt')
    expect(transcript).toContain('onDeletePrompt')
    expect(transcript).toContain('onMovePrompt')
})

test('reorder API and worker consume the same priority and FIFO order', async () => {
    const state: PromptPortalState = {
        items: [
            item('first', 'first next', 'next', '2026-01-01T00:00:00Z'),
            item('urgent', 'urgent now', 'now', '2026-01-02T00:00:00Z'),
            item('last', 'last next', 'next', '2026-01-03T00:00:00Z'),
        ],
    }
    await writeFile(join(stateDir, 'state.json'), JSON.stringify(state))

    const reorder = await POST(new NextRequest('https://app.test/api/prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', id: 'first', conversationId: 'conversation-1', direction: 'down' }),
    }))
    expect(reorder.status).toBe(200)

    const worker = await workerGet(new NextRequest('https://app.test/api/prompt/worker', { headers: { authorization: 'Bearer worker-test-token' } }))
    const payload = await worker.json()
    expect(worker.status).toBe(200)
    expect(payload.item.prompt).toContain('1. urgent now')
    expect(payload.item.prompt).toContain('2. last next')
    expect(payload.item.prompt).toContain('3. first next')
    const saved = JSON.parse(await readFile(join(stateDir, 'state.json'), 'utf8')) as PromptPortalState
    expect(saved.items.every(entry => entry.status === 'running')).toBe(true)
})
