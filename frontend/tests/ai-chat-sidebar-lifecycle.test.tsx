// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationList, groupConversations } from '../src/components/ai/chat/chatConversationList'
import { toConversationPayload } from '../src/components/ai/workbench/conversationModel'
import { branchConversation } from '../src/components/ai/workbench/branchConversation'

const conversation = (id: string, title: string, workspaceMeta: Record<string, unknown> = {}) => ({
    id,
    ownerId: 'owner',
    title,
    preferredModel: null,
    activeModel: null,
    modelStrategy: 'auto' as const,
    workspaceId: 'repo-1',
    workspaceKind: 'repo' as const,
    shareIds: [],
    workspaceMeta,
    messages: [],
    collaboration: { role: 'owner' as const, canInvite: true, seatLimit: 5, seatCount: 0, remainingSeats: 5, collaborators: [] },
    metrics: {} as GPT_ModelMetrics,
    archivedAt: null,
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
}) as AIConversation

test('chat rows keep pin and archive as the only inline lifecycle controls', () => {
    const item = conversation('chat-1', 'A long conversation title that must be truncated', { repositoryId: 'repo-1' })
    const html = renderToStaticMarkup(createElement(ConversationList, {
        conversations: [item],
        allConversations: [item],
        repositories: [{ id: 'repo-1', name: 'ai', fullName: 'hanasandcom/ai', branch: 'feature/sidebar' } as AIImportedRepo],
        activeConversationId: item.id,
        onArchiveConversation: () => {},
        onDeleteConversation: () => {},
        onRenameConversation: () => {},
        onSelectConversation: () => {},
        onPatchConversation: () => {},
        onBranchConversation: () => {},
        setStatusNotice: () => {},
    }))

    expect(html).toContain('truncate')
    expect(html).toContain('group-hover:pr-[3.75rem]')
    expect(html).toContain('absolute right-2 top-1/2')
    expect(html).toContain('Pin A long conversation title that must be truncated')
    expect(html).toContain('Archive A long conversation title that must be truncated')
    expect(html).toContain('press Shift+F10 for chat actions')
    expect(html).not.toContain('aria-label="Rename A long conversation')
    expect(html).not.toContain('aria-label="Delete A long conversation')
})

test('pinning and project/section assignment create stable sidebar groups', () => {
    const first = conversation('chat-1', 'First')
    const second = conversation('chat-2', 'Second', { sidebarProject: 'Website', sidebarSection: 'Polish' })
    const third = conversation('chat-3', 'Third', { sidebarPinnedAt: '2026-10-24T00:00:00.000Z' })

    expect(groupConversations([first, second, third])).toEqual([
        { key: 'group:pinned', label: 'Pinned', conversations: [third] },
        { key: 'group:chats', label: '', conversations: [first] },
        { key: 'group:Website / Polish', label: 'Website / Polish', conversations: [second] },
    ])
    expect(toConversationPayload(second).workspaceMeta).toEqual({ sidebarProject: 'Website', sidebarSection: 'Polish' })
})

test('branch creates a new chat, copies its completed history, and retains repository context', async () => {
    const originalFetch = globalThis.fetch
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'id=owner; access_token=token' },
    })
    const requests: Array<{ url: string, method: string, body?: Record<string, unknown> }> = []
    globalThis.fetch = (async (input, init) => {
        requests.push({
            url: String(input),
            method: init?.method || 'GET',
            body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        })
        return new Response(null, { status: 200 })
    }) as typeof fetch

    try {
        const source = {
            ...conversation('chat-source', 'Source chat', { repositoryId: 'repo-1', selectedFilePath: 'src/app.ts' }),
            messages: [
                { id: 'message-1', role: 'user' as const, content: 'Review this', createdAt: '2026-10-24T00:00:00.000Z' },
                { id: 'pending', role: 'assistant' as const, content: 'Working…', pending: true, createdAt: '2026-10-24T00:01:00.000Z' },
            ],
        }
        const result = await branchConversation(source)
        const creation = requests[0]
        const copiedMessage = requests[1]

        expect(requests).toHaveLength(2)
        expect(creation.url).toBe('/api/backend/ai/conversations')
        expect(creation.method).toBe('POST')
        expect(creation.body?.title).toBe('Source chat (branch)')
        expect((creation.body?.workspaceMeta as Record<string, unknown>).branchedFromConversationId).toBe(source.id)
        expect(copiedMessage.url).toBe(`/api/backend/ai/conversations/${result.id}/messages`)
        expect(copiedMessage.method).toBe('PUT')
        expect(copiedMessage.body?.id).not.toBe('message-1')
        expect(result.messages.map((message) => message.content)).toEqual(['Review this'])
    } finally {
        globalThis.fetch = originalFetch
        if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})
