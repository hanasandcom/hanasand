import { expect, mock, test } from 'bun:test'

const databaseCalls: Array<{ sql: string, params: unknown[] }> = []
const ownerConversation = {
    id: 'conversation-owned',
    owner_id: 'viewer-1',
    title: 'Owned',
    preferred_model: null,
    active_model: null,
    model_strategy: 'auto' as const,
    workspace_kind: null,
    workspace_id: null,
    share_ids: null,
    workspace_meta: null,
    archived_at: null,
    created_at: '2026-10-16T09:00:00.000Z',
    updated_at: '2026-10-16T10:00:00.000Z',
    access_role: 'owner' as const,
}
const sharedConversation = {
    ...ownerConversation,
    id: 'conversation-shared',
    owner_id: 'owner-2',
    title: 'Shared',
    created_at: '2026-10-15T09:00:00.000Z',
    updated_at: '2026-10-15T10:00:00.000Z',
    access_role: 'editor' as const,
}
const sharedMessages = [
    { id: 'message-later', conversation_id: sharedConversation.id, role: 'assistant', content: 'Second', pending: false, error: null, model_name: 'model', metadata: null, created_at: '2026-10-15T10:02:00.000Z', updated_at: '2026-10-15T10:02:00.000Z' },
    { id: 'message-earlier', conversation_id: sharedConversation.id, role: 'user', content: 'First', pending: false, error: null, model_name: null, metadata: null, created_at: '2026-10-15T10:01:00.000Z', updated_at: '2026-10-15T10:01:00.000Z' },
]

mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        databaseCalls.push({ sql, params })
        if (sql.includes('SELECT ai_conversations.*')) {
            return {
                rows: params.length === 1
                    ? [ownerConversation, sharedConversation]
                    : params[1] === sharedConversation.id ? [sharedConversation] : [],
            }
        }
        if (sql.includes('SELECT ai_messages.*')) {
            const rows = params.length === 1 || params[1] === sharedConversation.id ? [...sharedMessages] : []
            return { rows: rows.sort((left, right) => left.created_at.localeCompare(right.created_at)) }
        }
        if (sql.includes('SELECT collaborators.*, users.name AS user_name')) {
            return {
                rows: params.length === 1 || params[1] === sharedConversation.id ? [{
                    conversation_id: 'conversation-shared',
                    user_id: 'viewer-1',
                    role: 'editor',
                    invited_by: 'owner-2',
                    created_at: '2026-10-15T10:00:00.000Z',
                    user_name: 'Viewer',
                    user_avatar: null,
                }] : [],
            }
        }
        return { rows: [] }
    },
}))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: false, id: null }) }))
mock.module('../src/handlers/ai/deploymentShared.ts', () => ({
    getDeployQuota: async () => ({ limit: 5, used: 0, remaining: 5 }),
    toDeployment: (row: unknown) => row,
}))
mock.module('../src/handlers/ai/releaseShared.ts', () => ({ toReleaseBase: (row: unknown) => row }))
mock.module('../src/handlers/ai/runtime.ts', () => ({ buildAiRuntimeState: () => ({ status: 'ready' }) }))
mock.module('../src/utils/ai/repoCredentials.ts', () => ({ toRepoCredentialSummary: () => null }))
mock.module('../src/utils/ws/handleGptMessage.ts', () => ({ listGptClients: () => [], gpt: new Map() }))

const { getConversationBundleForUser, getConversationForUser, getWorkspaceBundle } = await import('../src/handlers/ai/shared.ts')

test('conversation lookup and workspace list share owner and collaborator access semantics', async () => {
    databaseCalls.length = 0

    const workspace = await getWorkspaceBundle('viewer-1')

    expect(workspace.conversations.map((conversation) => conversation.id)).toEqual([
        'conversation-owned',
        'conversation-shared',
    ])
    expect(workspace.conversations[0].collaboration).toMatchObject({ role: 'owner', canInvite: true })
    expect(workspace.conversations[1].collaboration).toMatchObject({ role: 'editor', canInvite: false, seatCount: 1 })

    const listQuery = databaseCalls.find((call) => call.params.length === 1 && call.sql.includes('SELECT ai_conversations.*'))
    expect(listQuery?.params).toEqual(['viewer-1'])
    expect(listQuery?.sql).toContain('ORDER BY updated_at DESC, created_at DESC')
    expect(listQuery?.sql).toContain('WHEN ai_conversations.owner_id = $1 THEN \'owner\'')
    expect(listQuery?.sql).toContain('ai_conversations.owner_id = $1\n            OR collaborators.user_id = $1')

    const conversation = await getConversationForUser('conversation-shared', 'viewer-1')

    expect(conversation).toMatchObject({ id: 'conversation-shared', access_role: 'editor' })
    const lookupQuery = databaseCalls.find((call) => call.params.length === 2 && call.sql.includes('SELECT ai_conversations.*'))
    expect(lookupQuery?.params).toEqual(['viewer-1', 'conversation-shared'])
    expect(lookupQuery?.sql).toContain('AND ai_conversations.id = $2')
    expect(lookupQuery?.sql).toContain('WHEN ai_conversations.owner_id = $1 THEN \'owner\'')
    expect(lookupQuery?.sql).toContain('ai_conversations.owner_id = $1\n            OR collaborators.user_id = $1')
    expect(lookupQuery?.sql).toContain('WHERE (\n            ai_conversations.owner_id = $1\n            OR collaborators.user_id = $1\n        )\n        AND ai_conversations.id = $2')
})

test('conversation mutation projection matches the workspace response with conversation-scoped queries', async () => {
    const workspace = await getWorkspaceBundle('viewer-1')
    const expected = workspace.conversations.find((entry) => entry.id === 'conversation-shared')
    databaseCalls.length = 0

    const actual = await getConversationBundleForUser('viewer-1', 'conversation-shared')

    expect(actual).toEqual(expected)
    expect(actual?.messages.map((message) => message.id)).toEqual(['message-earlier', 'message-later'])
    expect(actual?.messages[0]).toMatchObject({ role: 'user', content: 'First', metadata: {} })
    expect(databaseCalls).toHaveLength(3)
    expect(databaseCalls.every((call) => call.params[0] === 'viewer-1' && call.params[1] === 'conversation-shared')).toBe(true)
    const conversationQuery = databaseCalls.find((call) => call.sql.includes('SELECT ai_conversations.*'))
    const messageQuery = databaseCalls.find((call) => call.sql.includes('SELECT ai_messages.*'))
    const collaboratorQuery = databaseCalls.find((call) => call.sql.includes('SELECT collaborators.*, users.name AS user_name'))
    expect(conversationQuery?.sql).toContain('ai_conversations.owner_id = $1')
    expect(conversationQuery?.sql).toContain('collaborators.user_id = $1')
    expect(messageQuery?.sql).toContain('ai_conversations.owner_id = $1')
    expect(messageQuery?.sql).toContain('collaborators.user_id = $1')
    expect(messageQuery?.sql).toContain('AND ai_conversations.id = $2')
    expect(messageQuery?.sql).toContain('ORDER BY ai_messages.created_at ASC')
    expect(collaboratorQuery?.sql).toContain('ai_conversations.owner_id = $1')
    expect(collaboratorQuery?.sql).toContain('own_access.user_id = $1')
    expect(collaboratorQuery?.sql).toContain('AND collaborators.conversation_id = $2')

    databaseCalls.length = 0
    expect(await getConversationBundleForUser('viewer-1', 'conversation-inaccessible')).toBeNull()
    expect(databaseCalls).toHaveLength(3)
    expect(databaseCalls.every((call) => call.params[0] === 'viewer-1' && call.params[1] === 'conversation-inaccessible')).toBe(true)
})
