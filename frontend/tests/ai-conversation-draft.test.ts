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
import { handoffDraftPrompt } from '../src/components/ai/workbench/usePromptActions'

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

test('a draft is published and promoted only after the socket accepts its first prompt', async () => {
    const storage = memoryStorage()
    writePendingConversationDraft({ conversation: draft, composer: 'Keep this text' }, storage)
    let visibleConversation: AIConversation | null = null
    let responseObserved = false
    let finishPromotion: (() => void) | null = null
    const events: string[] = []

    const promotion = handoffDraftPrompt(
        () => { events.push('send') },
        () => {
            events.push('publish')
            visibleConversation = draft
            queueMicrotask(() => {
                responseObserved = Boolean(visibleConversation)
                events.push('response')
            })
        },
        () => {
            events.push('promote')
            return new Promise<void>((resolve) => { finishPromotion = resolve })
        }
    )

    assert.deepEqual(events, ['send', 'publish', 'promote'])
    await Promise.resolve()
    assert.equal(responseObserved, true)
    assert.equal(visibleConversation?.id, draft.id)
    finishPromotion?.()
    await promotion

    let published = false
    let promoted = false
    assert.throws(() => handoffDraftPrompt(
        () => { throw new Error('socket rejected prompt') },
        () => { published = true },
        async () => { promoted = true }
    ), /socket rejected prompt/)
    assert.equal(published, false)
    assert.equal(promoted, false)
    assert.equal(readPendingConversationDraft(storage)?.conversation.id, draft.id)
    assert.equal(reusePendingConversationDraft(null, readPendingConversationDraft(storage), () => ({ ...draft, id: 'second-draft' })).id, draft.id)
})
