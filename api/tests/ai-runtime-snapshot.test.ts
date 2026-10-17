import Fastify from 'fastify'
import { expect, mock, test } from 'bun:test'

const queries: Array<{ sql: string, params: unknown[] }> = []
const conversations = [
    {
        id: 'archived-owner', owner_id: 'viewer', title: 'Archived', preferred_model: null,
        active_model: null, model_strategy: 'auto', workspace_kind: 'repo', workspace_id: 'old',
        share_ids: null, workspace_meta: null, archived_at: '2026-10-17T12:00:00Z',
        created_at: '2026-10-16T12:00:00Z', updated_at: '2026-10-17T12:00:00Z', access_role: 'owner',
    },
    {
        id: 'shared-active', owner_id: 'other', title: 'Shared', preferred_model: null,
        active_model: null, model_strategy: 'auto', workspace_kind: 'share', workspace_id: 'shared',
        share_ids: ['share-1'], workspace_meta: { source: 'shared' }, archived_at: null,
        created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-16T12:00:00Z', access_role: 'editor',
    },
    {
        id: 'owned-active', owner_id: 'viewer', title: 'Owned', preferred_model: null,
        active_model: null, model_strategy: 'auto', workspace_kind: null, workspace_id: null,
        share_ids: null, workspace_meta: null, archived_at: null,
        created_at: '2026-10-14T12:00:00Z', updated_at: '2026-10-15T12:00:00Z', access_role: 'owner',
    },
]
const messages = [
    {
        id: 'tool-message', conversation_id: 'owned-active', role: 'tool', content: 'ran tool',
        pending: false, error: false, model_name: null, metadata: { tool: 'shell', toolState: 'running' },
        created_at: '2026-10-17T12:05:00Z', updated_at: '2026-10-17T12:05:00Z',
    },
    {
        id: 'failure-message', conversation_id: 'shared-active', role: 'assistant', content: 'failed',
        pending: false, error: true, model_name: null, metadata: null,
        created_at: '2026-10-17T12:06:00Z', updated_at: '2026-10-17T12:06:00Z',
    },
]

mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'viewer' }) }))
mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        if (sql.includes('SELECT ai_conversations.*')) return { rows: conversations }
        if (sql.includes('SELECT ai_messages.*')) return { rows: messages }
        return { rows: [] }
    },
}))
mock.module('#utils/ws/handleGptMessage.ts', () => ({ gpt: new Map(), listGptClients: () => [] }))
mock.module('#utils/ai/repoCredentials.ts', () => ({ toRepoCredentialSummary: () => null }))
mock.module('../src/handlers/ai/deploymentShared.ts', () => ({ getDeployQuota: async () => ({}), toDeployment: (row: unknown) => row }))
mock.module('../src/handlers/ai/releaseShared.ts', () => ({ toReleaseBase: (row: unknown) => row }))

const { default: getAiRuntime } = await import('../src/handlers/ai/getRuntime.ts')

test('runtime endpoint returns the same state from owner and shared conversations only', async () => {
    queries.length = 0
    const app = Fastify()
    app.get('/ai/runtime', getAiRuntime)

    try {
        const response = await app.inject('/ai/runtime')
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
            runtimeState: {
                status: 'error',
                connectedClientCount: 0,
                connectedModelNames: [],
                activeConversationId: 'shared-active',
                activeWorkspace: {
                    conversationId: 'shared-active', workspaceId: 'shared', workspaceKind: 'share',
                    shareIds: ['share-1'], workspaceMeta: { source: 'shared' },
                },
                lastToolRun: {
                    conversationId: 'owned-active', label: 'shell', detail: 'ran tool',
                    state: 'running', updatedAt: '2026-10-17T12:05:00Z',
                },
                lastFailure: {
                    source: 'conversation', message: 'failed', conversationId: 'shared-active',
                    updatedAt: '2026-10-17T12:06:00Z',
                },
                lastUpdatedAt: '2026-10-16T12:00:00Z',
            },
        })
        expect(queries).toHaveLength(2)
        expect(queries.every((query) => query.params[0] === 'viewer')).toBe(true)
        expect(queries.every((query) => query.sql.includes('collaborators.user_id = $1'))).toBe(true)
        expect(queries.find((query) => query.sql.includes('SELECT ai_conversations.*'))?.sql)
            .toContain('ORDER BY updated_at DESC, created_at DESC')
        expect(queries.some((query) => query.sql.includes('ai_releases'))).toBe(false)
    } finally {
        await app.close()
    }
})
