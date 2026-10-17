import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { runWorkflowAction } from '../src/app/dashboard/findings/workflow-action-lifecycle.ts'

function createState(events: string[]) {
    return {
        setBusyAction(value: string | null) {
            events.push(`busy:${value}`)
        },
        setResult(value: unknown) {
            events.push(value ? `result:${JSON.stringify(value)}` : 'result:clear')
        },
    } as never
}

test('workflow actions clear prior results and busy state after success', async() => {
    const events: string[] = []
    await runWorkflowAction(createState(events), 'delivery', async() => {
        events.push('action')
        events.push('result:success')
    })
    assert.deepEqual(events, ['busy:delivery', 'result:clear', 'action', 'result:success', 'busy:null'])
})

test('workflow actions map thrown errors to a failure result and clear busy state', async() => {
    const events: string[] = []
    await runWorkflowAction(createState(events), 'source', async() => {
        events.push('action')
        throw new Error('source unavailable')
    })
    assert.deepEqual(events, [
        'busy:source', 'result:clear', 'action',
        'result:{"ok":false,"message":"source unavailable"}', 'busy:null',
    ])
})

test('workflow actions stringify non-Error failures and clear busy state', async() => {
    const events: string[] = []
    await runWorkflowAction(createState(events), 'watchlist', async() => { throw 'request rejected' })
    assert.deepEqual(events, [
        'busy:watchlist', 'result:clear',
        'result:{"ok":false,"message":"request rejected"}', 'busy:null',
    ])
})
