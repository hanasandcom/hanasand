import { describe, expect, test } from 'bun:test'
import { buildAiRuntimeState } from '../src/handlers/ai/runtime.ts'

describe('AI runtime state', () => {
    test('selects the latest tool run and failure independently across conversations', () => {
        const state = buildAiRuntimeState({
            conversations: [
                {
                    id: 'tool-conversation',
                    workspaceId: 'repo-tool',
                    workspaceKind: 'repo',
                    shareIds: [],
                    workspaceMeta: {},
                    updatedAt: '2026-10-16T09:00:00.000Z',
                    messages: [
                        { role: 'tool', content: 'newest tool', createdAt: '2026-10-16T09:03:00.000Z' },
                        { role: 'assistant', content: 'older failure', error: true, createdAt: '2026-10-16T09:02:00.000Z' },
                    ],
                },
                {
                    id: 'failure-conversation',
                    workspaceId: 'repo-failure',
                    workspaceKind: 'repo',
                    shareIds: [],
                    workspaceMeta: {},
                    updatedAt: '2026-10-16T10:00:00.000Z',
                    messages: [
                        { role: 'tool', content: 'older tool', createdAt: '2026-10-16T09:01:00.000Z' },
                        { role: 'assistant', content: 'newest failure', error: true, createdAt: '2026-10-16T09:04:00.000Z' },
                    ],
                },
            ],
        })

        expect(state.lastToolRun).toMatchObject({ conversationId: 'tool-conversation', detail: 'newest tool' })
        expect(state.lastFailure).toMatchObject({ conversationId: 'failure-conversation', message: 'newest failure' })
        expect(state.lastToolRun?.conversationId).not.toBe(state.lastFailure?.conversationId)
    })
})
