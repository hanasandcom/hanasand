// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { mergeConversationMessages, parseConversationProviderPreferences, setConversationProvider } from '../src/components/ai/workbench/providerSelection'
import { serializePromptContext } from '../src/utils/promptPortal/context'

test('assistant provider preference is isolated by conversation and can be restored from storage', () => {
    const first = setConversationProvider({}, 'conversation-one', 'chatgpt')
    const both = setConversationProvider(first, 'conversation-two', 'hanasand')

    expect(both).toEqual({ 'conversation-one': 'chatgpt', 'conversation-two': 'hanasand' })
    expect(parseConversationProviderPreferences(JSON.stringify(both))).toEqual(both)
    expect(parseConversationProviderPreferences('{bad json')).toEqual({})
    expect(setConversationProvider(both, '', 'chatgpt')).toBe(both)
})

test('provider choice merges into the same chronological conversation transcript', () => {
    const hanasand = [{ id: 'h-1', role: 'assistant', content: 'Earlier Hanasand reply', createdAt: '2026-10-20T10:00:00Z' }]
    const chatgpt = [{ id: 'c-1', role: 'assistant', content: 'Later ChatGPT reply', createdAt: '2026-10-20T10:01:00Z' }]

    expect(mergeConversationMessages(hanasand, chatgpt).map(message => message.id)).toEqual(['h-1', 'c-1'])
    expect(mergeConversationMessages(hanasand, chatgpt)).toHaveLength(2)
})

test('ChatGPT context includes completed messages from both providers and skips pending reply placeholders', () => {
    const context = serializePromptContext([
        { id: 'h-user', role: 'user', content: 'Hanasand question', createdAt: '2026-10-20T10:00:00Z' },
        { id: 'h-assistant', role: 'assistant', content: 'Hanasand answer', createdAt: '2026-10-20T10:01:00Z' },
    ], [
        { id: 'c-user', role: 'user', content: 'ChatGPT follow-up', createdAt: '2026-10-20T10:02:00Z', metadata: { promptPortalId: 'portal-1', files: [{ id: 'image-1' }] } },
        { id: 'c-pending', role: 'assistant', content: 'Working on it…', createdAt: '2026-10-20T10:02:01Z', metadata: { promptPortalStatus: 'running' } },
        { id: 'c-assistant', role: 'assistant', content: 'ChatGPT answer', createdAt: '2026-10-20T10:03:00Z', modelName: 'ChatGPT' },
    ])

    expect(context.map(message => message.content)).toEqual(['Hanasand question', 'Hanasand answer', 'ChatGPT follow-up', 'ChatGPT answer'])
    expect(context[2].files).toEqual([{ itemId: 'portal-1', fileId: 'image-1' }])
})
