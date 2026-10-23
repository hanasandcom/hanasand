// @ts-expect-error Bun provides this module for focused tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { WorkbenchState } from '../src/components/ai/workbench/useWorkbenchState'

const { useCollaborationActions } = await import('../src/components/ai/workbench/useCollaborationActions')
type CollaborationActions = ReturnType<typeof useCollaborationActions>
type ApiRequest = (path: string, init?: RequestInit) => Promise<Response>

function mountActions(state: WorkbenchState, active: AIConversation, conversationId: string, replace: (value: AIConversation) => void, patch: (id: string, value: Partial<AIConversation>) => void, request: ApiRequest) {
    let actions: CollaborationActions | null = null
    function Harness() {
        actions = useCollaborationActions(state, active, conversationId, replace, patch, request)
        return null
    }
    renderToStaticMarkup(createElement(Harness))
    if (!actions) throw new Error('Could not mount collaboration actions.')
    return actions
}

function conversation(role: 'owner' | 'reviewer' = 'owner'): AIConversation {
    return {
        id: 'conversation-1',
        ownerId: 'owner-1',
        collaboration: {
            role,
            canInvite: role === 'owner',
            seatLimit: 5,
            seatCount: 2,
            remainingSeats: 3,
            collaborators: [{ userId: 'editor-1', role: 'editor' }],
        },
    } as AIConversation
}

function makeState(initialConversations: AIConversation[], currentUserId = 'owner-1') {
    let conversations = initialConversations
    let activeConversationId: string | null = initialConversations[0]?.id || null
    const errors: Array<string | null> = []
    const pending: boolean[] = []
    const notices: string[] = []
    return {
        state: {
            isAuthenticated: true,
            currentUserId,
            setCollaborationError: (value: string | null) => errors.push(value),
            setCollaboratorPending: (value: boolean) => pending.push(value),
            setStatusNotice: (value: string) => notices.push(value),
            setConversations: (update: (previous: AIConversation[]) => AIConversation[]) => { conversations = update(conversations) },
            conversationsRef: { current: initialConversations },
            setActiveConversationId: (value: string | null) => { activeConversationId = value },
        } as unknown as WorkbenchState,
        get conversations() { return conversations },
        get activeConversationId() { return activeConversationId },
        errors,
        pending,
        notices,
    }
}

test('owner invite trims the user id, sends the selected role, and replaces the conversation', async () => {
    const active = conversation()
    const updated = {
        ...active,
        collaboration: { ...active.collaboration, seatCount: 3, remainingSeats: 2 },
    } as AIConversation
    let requestPath = ''
    let requestInit: RequestInit | undefined
    const request: ApiRequest = async (path, init) => {
        requestPath = path
        requestInit = init
        return Response.json({ conversation: updated })
    }
    const state = makeState([active])
    let replaced: AIConversation | null = null
    const actions = mountActions(state.state, active, active.id, (value) => { replaced = value }, () => {}, request)

    await actions.inviteCollaborator(' editor-2 ', 'reviewer')

    expect(requestPath).toBe('/ai/conversations/conversation-1/collaborators')
    expect(requestInit?.method).toBe('POST')
    expect(JSON.parse(String(requestInit?.body))).toEqual({ userId: 'editor-2', role: 'reviewer' })
    expect(replaced).toEqual(updated)
    expect(state.pending).toEqual([true, false])
    expect(state.errors).toEqual([null])
    expect(state.notices).toEqual(['Shared this review session with editor-2 as reviewer.'])
})

test('owner removal updates the local collaborator and seat counts', async () => {
    const active = conversation()
    const request: ApiRequest = async (path, init) => {
        expect(path).toBe('/ai/conversations/conversation-1/collaborators/editor-1')
        expect(init?.method).toBe('DELETE')
        return Response.json({ ok: true, conversation: null })
    }
    const state = makeState([active])
    let patch: Partial<AIConversation> | null = null
    const actions = mountActions(state.state, active, active.id, () => {}, (_id, value) => { patch = value }, request)

    await actions.removeCollaborator('editor-1')

    expect(patch?.collaboration).toMatchObject({ seatCount: 1, remainingSeats: 4, collaborators: [] })
    expect(state.pending).toEqual([true, false])
    expect(state.notices).toEqual(['Removed editor-1 from this review session.'])
})

test('collaborator self-leave removes the shared chat and selects the next conversation', async () => {
    const shared = conversation('reviewer')
    const next = { ...conversation(), id: 'conversation-2' } as AIConversation
    const request: ApiRequest = async () => Response.json({ ok: true, conversation: null })
    const state = makeState([shared, next], 'reviewer-1')
    state.state.conversationsRef.current = [shared, next]
    const actions = mountActions(state.state, shared, shared.id, () => {}, () => {}, request)

    await actions.removeCollaborator('reviewer-1')

    expect(state.conversations).toEqual([next])
    expect(state.activeConversationId).toBe(next.id)
    expect(state.notices).toEqual(['You left the shared review session.'])
})

test('invite errors reach the access panel and always clear the pending state', async () => {
    const active = conversation()
    const request: ApiRequest = async () => Response.json({ error: 'Collaborator seat limit reached.' }, { status: 409 })
    const state = makeState([active])
    const actions = mountActions(state.state, active, active.id, () => {}, () => {}, request)

    await actions.inviteCollaborator('editor-2', 'editor')

    expect(state.errors).toEqual([null, 'Collaborator seat limit reached.'])
    expect(state.pending).toEqual([true, false])
    expect(state.notices).toEqual([])
})
