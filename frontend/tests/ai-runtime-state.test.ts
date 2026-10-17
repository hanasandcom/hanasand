import { expect, test } from 'bun:test'
import { deriveLastFailure, deriveLastToolState } from '../src/components/ai/workbench/runtimeState'

const conversations = [
    conversation('older', [toolMessage('old-tool', '2026-01-01T00:00:00Z'), failureMessage('old-failure', '2026-01-02T00:00:00Z')]),
    conversation('newer', [toolMessage('new-tool', '2026-01-03T00:00:00Z'), failureMessage('new-failure', '2026-01-04T00:00:00Z')]),
]

test('runtime summaries select the newest matching message across conversations', () => {
    expect(deriveLastToolState(conversations)).toMatchObject({
        conversationId: 'newer', label: 'new-tool', detail: 'tool output', state: 'completed', updatedAt: '2026-01-03T00:00:00Z',
    })
    expect(deriveLastFailure(conversations, null)).toEqual({
        message: 'failure output', conversationId: 'newer', updatedAt: '2026-01-04T00:00:00Z', source: 'conversation',
    })
})

test('equal timestamps keep the original conversation order', () => {
    const tied = [
        conversation('first', [toolMessage('first-tool', '2026-01-05T00:00:00Z')]),
        conversation('second', [toolMessage('second-tool', '2026-01-05T00:00:00Z')]),
    ]
    expect(deriveLastToolState(tied)?.conversationId).toBe('first')
})

test('runtime failure falls back to the current status notice when no message failed', () => {
    expect(deriveLastFailure([], 'Connection paused')).toMatchObject({
        message: 'Connection paused', conversationId: null, source: 'conversation',
    })
    expect(deriveLastFailure([], null)).toBeNull()
})

function conversation(id: string, messages: AIConversationMessage[]): AIConversation {
    return { id, messages } as AIConversation
}

function toolMessage(tool: string, createdAt: string): AIConversationMessage {
    return { id: tool, role: 'tool', content: 'tool output', createdAt, metadata: { toolState: 'completed', tool } }
}

function failureMessage(id: string, createdAt: string): AIConversationMessage {
    return { id, role: 'assistant', content: 'failure output', createdAt, error: true }
}
