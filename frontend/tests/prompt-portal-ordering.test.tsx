import { afterAll, expect, mock, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import type { PromptPortalItem, PromptPortalState } from '../src/utils/promptPortal/store'
import { comparePromptItems } from '../src/utils/promptPortal/ordering'
import { PromptQueue } from '../src/app/prompt/PromptQueue'
import PromptPortalClient from '../src/app/prompt/promptPortalClient'

const previousStateDir = process.env.PROMPT_PORTAL_STATE_DIR
const previousWorkerToken = process.env.PROMPT_PORTAL_WORKER_TOKEN
const stateDir = await mkdtemp(join(tmpdir(), 'prompt-portal-ordering-'))
process.env.PROMPT_PORTAL_STATE_DIR = stateDir
process.env.PROMPT_PORTAL_WORKER_TOKEN = 'worker-test-token'
mock.module('../src/utils/proxy/requireApiSession', () => ({
    default: async () => ({ identity: { id: 'user-1', token: 'session-token' } }),
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

test('queue UI keeps labels and limits reorder controls to queued items', () => {
    const queued = [
        item('now', 'urgent instruction', 'now', '2026-01-01T00:00:00Z'),
        item('next', 'following instruction', 'next', '2026-01-02T00:00:00Z'),
    ]
    const running = { ...item('running', 'in progress', 'next', '2026-01-03T00:00:00Z'), status: 'running' as const }
    const html = renderToStaticMarkup(createElement(PromptQueue, {
        title: 'Input queue',
        items: [...queued, running],
        empty: 'No queued instructions.',
        onMove: () => {},
        onEdit: () => {},
        onDelete: () => {},
    }))

    expect(html).toContain('Input queue')
    expect(html.indexOf('urgent instruction')).toBeLessThan(html.indexOf('following instruction'))
    expect(html).toContain('Now · queued')
    expect(html).toContain('#2 · queued')
    expect(html).toContain('Running · running')
    expect((html.match(/title="Move up"/g) || [])).toHaveLength(2)
    expect(html).toMatch(/<button[^>]*title="Move up"[^>]*disabled=""[^>]*>/)
    expect(html).toMatch(/<button[^>]*title="Move down"[^>]*disabled=""[^>]*>/)

    const firstNext = renderToStaticMarkup(createElement(PromptQueue, {
        title: 'Input queue', items: [queued[1]], empty: 'No queued instructions.',
    }))
    expect(firstNext).toContain('Next · queued')
    expect(firstNext).not.toContain('title="Edit"')
})

test('portal renders the queue for authenticated organization members', () => {
    const locked = renderToStaticMarkup(createElement(PromptPortalClient))
    expect(locked).toContain('<h1 class="mt-2 text-3xl font-semibold tracking-normal">Prompt</h1>')
    expect(locked).toContain('Input queue')

    const populated = renderToStaticMarkup(createElement(PromptPortalClient, {
        initialState: {
            items: [item('queued', 'Existing instruction', 'next', '2026-01-01T00:00:00Z')],
        },
    }))
    expect(populated).toContain('Input queue')
    expect(populated).toContain('Existing instruction')
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
        body: JSON.stringify({ action: 'reorder', id: 'first', direction: 'down' }),
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
