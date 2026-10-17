import { expect, test } from 'bun:test'
import { updateConversationState } from '../src/components/ai/workbench/conversationModel'

test('conversation updates return the new state and synchronize the live ref', () => {
    const original = [{ id: 'conversation-1', title: 'Before' }] as AIConversation[]
    const conversationsRef = { current: original }
    let state = original

    updateConversationState(conversationsRef, (update) => {
        state = update(state)
    }, (conversations) => conversations.map((conversation) => (
        conversation.id === 'conversation-1' ? { ...conversation, title: 'After' } : conversation
    )))

    expect(state).toEqual([{ id: 'conversation-1', title: 'After' }])
    expect(conversationsRef.current).toBe(state)
    expect(original).toEqual([{ id: 'conversation-1', title: 'Before' }])
})
