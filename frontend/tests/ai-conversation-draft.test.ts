import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import {
    clearPendingConversationDraft,
    promoteDraftOnce,
    readPendingConversationDraft,
    reusePendingConversationDraft,
    writePendingConversationDraft,
} from '../src/components/ai/workbench/conversationDraftStorage'

function memoryStorage() {
    const values = new Map<string, string>()
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value) },
        removeItem: (key: string) => { values.delete(key) },
    }
}

const draft = { id: 'draft-1', title: 'New chat', messages: [], shareIds: [], workspaceMeta: {} } as AIConversation

test('pending draft and composer restore from local storage and clear after promotion', () => {
    const storage = memoryStorage()
    writePendingConversationDraft({ conversation: draft, composer: 'Keep this text' }, storage)
    assert.deepEqual(readPendingConversationDraft(storage), { conversation: draft, composer: 'Keep this text' })
    clearPendingConversationDraft(storage)
    assert.equal(readPendingConversationDraft(storage), null)
})

test('repeated New chat actions reuse the same in-memory or persisted draft', () => {
    const stored = { conversation: draft, composer: 'unsent' }
    let creates = 0
    const create = () => { creates += 1; return { ...draft, id: 'draft-2' } }
    assert.equal(reusePendingConversationDraft(null, stored, create), draft)
    assert.equal(reusePendingConversationDraft(draft, null, create), draft)
    assert.equal(creates, 0)
})

test('concurrent promotion sends share one request and a failed request can retry with the same draft id', async () => {
    const promotions = new Map<string, Promise<string>>()
    const requestIds: string[] = []
    let fail = true
    const promote = () => promoteDraftOnce(draft.id, promotions, async () => {
        requestIds.push(draft.id)
        await Promise.resolve()
        if (fail) throw new Error('temporary failure')
        return 'created'
    })

    const first = promote()
    const concurrent = promote()
    assert.equal(first, concurrent)
    await assert.rejects(first, /temporary failure/)
    fail = false
    assert.equal(await promote(), 'created')
    assert.deepEqual(requestIds, ['draft-1', 'draft-1'])
})
