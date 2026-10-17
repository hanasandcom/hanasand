import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { createAssistantMessage, createUserMessage, toRequestMessages } from '../src/components/gpt/chatMessages'
import { applyPromptEvent } from '../src/components/gpt/chatReducers'
import defaultModelMetrics from '../src/components/gpt/defaultModelMetrics'

function session(): ChatSession {
    return {
        clientName: 'model-a',
        conversationId: 'conversation-a',
        isSending: true,
        metrics: { ...defaultModelMetrics(), status: 'generating', currentTokens: 9 },
        messages: [
            { id: 'user-a', role: 'user', content: 'hello' },
            { id: 'assistant-a', role: 'assistant', content: 'Hel', pending: true },
        ],
    }
}

test('shared chat message helpers preserve pending state and request projection', () => {
    const user = createUserMessage('hello')
    const pending = createAssistantMessage('conversation-a')

    assert.match(user.id, /^[0-9a-f-]{36}$/i)
    assert.deepEqual(pending, { id: 'conversation-a-assistant', role: 'assistant', content: '', pending: true })
    assert.deepEqual(toRequestMessages([
        user,
        pending,
        { id: 'system', role: 'system', content: 'internal prompt' },
    ]), [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: '' },
    ])
})

test('shared prompt reducer preserves streamed delta and completion behavior', () => {
    const streaming = applyPromptEvent(session(), {
        type: 'prompt_delta', conversationId: 'conversation-a', delta: 'lo',
    })!
    assert.equal(streaming.messages[1]?.content, 'Hello')
    assert.equal(streaming.messages[1]?.pending, true)
    assert.equal(streaming.isSending, true)

    const completed = applyPromptEvent(streaming, {
        type: 'prompt_complete', conversationId: 'conversation-a', content: 'Hello there',
    })!
    assert.equal(completed.messages[1]?.content, 'Hello there')
    assert.equal(completed.messages[1]?.pending, false)
    assert.equal(completed.isSending, false)
})

test('page error fallback preserves its existing session metrics', () => {
    const prior = session()
    const error: GptSocketMessage = {
        type: 'prompt_error', conversationId: prior.conversationId, error: 'unavailable',
    }
    const pageFallback = (current: ChatSession, content: string): GPT_ModelMetrics => ({
        ...current.metrics,
        status: 'error',
        lastError: content,
    })

    const result = applyPromptEvent(prior, error, pageFallback)!
    assert.deepEqual(result.metrics, { ...prior.metrics, status: 'error', lastError: 'unavailable' })
    assert.equal(result.messages[1]?.content, 'unavailable')
    assert.equal(result.messages[1]?.error, true)
})

test('default error fallback retains shared-chat defaults and session metrics', () => {
    const prior = session()
    const result = applyPromptEvent(prior, {
        type: 'prompt_error', conversationId: prior.conversationId, error: 'unavailable',
    })!

    assert.equal(result.metrics.currentTokens, prior.metrics.currentTokens)
    assert.equal(result.metrics.status, 'error')
    assert.equal(result.metrics.lastError, 'unavailable')
    assert.equal(result.isSending, false)
})
