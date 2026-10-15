import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let repositoryOwner: string | null = null
let messageConversationId: string | null = null
let messageIdExists = false
const repositoryQueries: Array<{ sql: string; params: unknown[] }> = []
const messageQueries: Array<{ sql: string; params: unknown[] }> = []

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim()

const repositoryQuery = async (sql: string, params: unknown[] = []) => {
    const normalized = normalizeSql(sql)
    repositoryQueries.push({ sql: normalized, params })

    if (normalized.startsWith('INSERT INTO ai_imported_repositories')) {
        const ownerId = String(params[1])
        if (repositoryOwner && repositoryOwner !== ownerId
            && normalized.includes('WHERE ai_imported_repositories.owner_id = EXCLUDED.owner_id')) {
            return { rows: [] }
        }
        repositoryOwner = ownerId
        return { rows: [{ id: params[0] }] }
    }

    return { rows: [] }
}

const messageQuery = async (sql: string, params: unknown[] = []) => {
    const normalized = normalizeSql(sql)
    messageQueries.push({ sql: normalized, params })

    if (normalized.startsWith('SELECT 1 FROM ai_messages')) {
        return { rows: messageIdExists ? [{ '?column?': 1 }] : [] }
    }

    if (normalized.startsWith('INSERT INTO ai_messages')) {
        if (messageConversationId && messageConversationId !== String(params[1])
            && normalized.includes('WHERE ai_messages.conversation_id = EXCLUDED.conversation_id')) {
            return { rows: [] }
        }
        messageConversationId = String(params[1])
        messageIdExists = true
        return { rows: [{ id: params[0] }] }
    }

    return { rows: [] }
}

mock.module('#db', () => ({
    default: messageQuery,
    withTransaction: async (work: (query: typeof repositoryQuery) => unknown) => work(repositoryQuery),
}))
mock.module('../src/handlers/ai/shared.ts', () => ({
    requireAiUser: async () => 'user-1',
    getConversationForUser: async (conversationId: string) => ({
        id: conversationId,
        owner_id: 'user-1',
        workspace_kind: null,
        workspace_id: null,
        access_role: 'owner',
    }),
}))
mock.module('#utils/ai/usage.ts', () => ({ recordAiUsageEvent: async () => {} }))

const { default: postAiRepository } = await import('../src/handlers/ai/postRepository.ts')
const { default: upsertAiMessage } = await import('../src/handlers/ai/upsertMessage.ts')

const app = Fastify()
app.post('/repositories', postAiRepository)
app.put('/conversations/:id/messages', upsertAiMessage)

beforeEach(() => {
    repositoryOwner = null
    messageConversationId = null
    messageIdExists = false
    repositoryQueries.length = 0
    messageQueries.length = 0
})

test('repository ID owned by another user returns 409 without replacing its files', async () => {
    repositoryOwner = 'user-2'

    const response = await app.inject({
        method: 'POST',
        url: '/repositories',
        payload: { id: 'repo-1', fullName: 'owner/repo', files: [{ path: 'README.md', name: 'README.md', content: 'new' }] },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Repository id is already owned by another user.' })
    expect(repositoryOwner).toBe('user-2')
    expect(repositoryQueries.some(query => query.sql.startsWith('DELETE FROM ai_imported_repository_files'))).toBe(false)
    expect(repositoryQueries.some(query => query.sql.startsWith('INSERT INTO ai_imported_repository_files'))).toBe(false)
})

test('repository owner can update the repository and replace its files', async () => {
    repositoryOwner = 'user-1'

    const response = await app.inject({
        method: 'POST',
        url: '/repositories',
        payload: { id: 'repo-1', fullName: 'owner/repo', files: [{ path: 'README.md', name: 'README.md', content: 'updated' }] },
    })

    expect(response.statusCode).toBe(201)
    expect(repositoryQueries.some(query => query.sql.startsWith('DELETE FROM ai_imported_repository_files'))).toBe(true)
    expect(repositoryQueries.some(query => query.sql.startsWith('INSERT INTO ai_imported_repository_files'))).toBe(true)
})

test('message ID belonging to another conversation returns 409 without mutating either conversation', async () => {
    messageConversationId = 'conversation-2'
    messageIdExists = true

    const response = await app.inject({
        method: 'PUT',
        url: '/conversations/conversation-1/messages',
        payload: { id: 'message-1', role: 'user', content: 'replacement' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Message id belongs to another conversation.' })
    expect(messageConversationId).toBe('conversation-2')
    expect(messageQueries.some(query => query.sql.startsWith('UPDATE ai_conversations'))).toBe(false)
})

test('message can be updated within its existing conversation', async () => {
    messageConversationId = 'conversation-1'
    messageIdExists = true

    const response = await app.inject({
        method: 'PUT',
        url: '/conversations/conversation-1/messages',
        payload: { id: 'message-1', role: 'user', content: 'updated' },
    })

    expect(response.statusCode).toBe(201)
    expect(messageQueries.some(query => query.sql.startsWith('UPDATE ai_conversations'))).toBe(true)
})
