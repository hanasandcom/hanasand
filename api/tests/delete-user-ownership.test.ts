import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let blocker: { id: string, name: string, active_api_key: boolean } | null = null
let existingDeletionDeadline: string | null = null
let internalMembership = false
const queries: string[] = []
const tokenRevocations: Array<{ userId: string, revokedBy: string }> = []
const recordedEvents: Array<Record<string, unknown>> = []

mock.module('#db', () => ({
    default: async (sql: string) => query(sql),
    withTransaction: async (work: (query: typeof queryOnce) => unknown) => work(queryOnce),
}))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'admin-user' }) }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: true }) }))
mock.module('../src/utils/auth/session.ts', () => ({ revokeAllTokens: async (input: { userId: string, revokedBy: string }) => { tokenRevocations.push(input) } }))
mock.module('../src/utils/systemEvent.ts', () => ({
    recordSystemEvent: async (_req: unknown, event: Record<string, unknown>) => { recordedEvents.push(event) },
    userHasHanasandInternalAccess: async () => internalMembership,
}))

const { default: deleteUser } = await import('../src/handlers/user/deleteUser.ts')

const app = Fastify()
app.delete('/users/:id', deleteUser)
afterAll(async () => app.close())

async function query(sql: string) {
    queries.push(sql.replace(/\s+/g, ' ').trim())
    if (sql.includes('FROM organizations organization') && sql.includes('NOT EXISTS')) {
        return { rows: blocker ? [blocker] : [] }
    }
    if (sql.includes('UPDATE users')) {
        if (existingDeletionDeadline && sql.includes('deletion_scheduled_at IS NULL')) return { rows: [] }
        existingDeletionDeadline = '2026-11-15T12:00:00.000Z'
        return { rows: [{
            id: 'target-user', name: 'Target', avatar: null, active: true,
            deletion_requested_at: '2026-10-16T12:00:00.000Z', deletion_scheduled_at: existingDeletionDeadline,
        }] }
    }
    if (sql.includes('deletion_scheduled_at IS NOT NULL')) {
        return { rows: existingDeletionDeadline ? [{
            id: 'target-user', name: 'Target', avatar: null, active: true,
            deletion_requested_at: '2026-09-20T12:00:00.000Z', deletion_scheduled_at: existingDeletionDeadline,
        }] : [] }
    }
    return { rows: [] }
}

const queryOnce = query

beforeEach(() => {
    blocker = null
    existingDeletionDeadline = null
    internalMembership = false
    queries.length = 0
    tokenRevocations.length = 0
    recordedEvents.length = 0
})

test('admin deletion returns the owner-transfer conflict before scheduling or revoking access', async () => {
    blocker = { id: 'org-1', name: 'Only Owner Org', active_api_key: true }

    const response = await app.inject({ method: 'DELETE', url: '/users/target-user' })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'organization_ownership_transfer_required', organization_id: 'org-1', active_api_key: true })
    expect(queries.some(sql => sql.startsWith('UPDATE users'))).toBe(false)
    expect(tokenRevocations).toEqual([])
})

test('admin deletion proceeds when the organization has another active owner', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/users/target-user' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ pending_deletion: true, user: { id: 'target-user' } })
    expect(queries.some(sql => sql.includes('deletion_requested_at = NOW()') && sql.includes('deletion_scheduled_at = NOW() + INTERVAL \'30 days\''))).toBe(true)
    expect(queries.some(sql => sql.startsWith('DELETE FROM users'))).toBe(false)
    expect(tokenRevocations).toEqual([{ userId: 'target-user', revokedBy: 'admin-user' }])
    expect(recordedEvents).toEqual([{
        actionType: 'user.account.deleted',
        actorId: 'admin-user',
        source: 'admin',
        targetType: 'user',
        targetId: 'target-user',
        severity: 'warning',
        context: { deletionMode: 'scheduled', targetName: 'Target', targetId: 'target-user', hanasandOrganizationMember: false },
    }])
})

test('admin deletion records the critical internal-account audit pair', async () => {
    internalMembership = true

    const response = await app.inject({ method: 'DELETE', url: '/users/target-user' })

    expect(response.statusCode).toBe(200)
    expect(recordedEvents).toEqual([
        {
            actionType: 'user.account.deleted',
            actorId: 'admin-user',
            source: 'admin',
            targetType: 'user',
            targetId: 'target-user',
            severity: 'critical',
            context: { deletionMode: 'scheduled', targetName: 'Target', targetId: 'target-user', hanasandOrganizationMember: true },
        },
        {
            actionType: 'admin.account.deleted',
            actorId: 'admin-user',
            source: 'admin',
            targetType: 'user',
            targetId: 'target-user',
            severity: 'critical',
            context: { deletionMode: 'scheduled', targetName: 'Target', targetId: 'target-user' },
        },
    ])
})

test('admin deletion returns an existing schedule without extending its restore window', async () => {
    existingDeletionDeadline = '2026-10-20T12:00:00.000Z'

    const response = await app.inject({ method: 'DELETE', url: '/users/target-user' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
        pending_deletion: true,
        user: { id: 'target-user', deletion_scheduled_at: existingDeletionDeadline },
    })
    expect(queries.some(sql => sql.includes('deletion_scheduled_at = NOW() + INTERVAL \'30 days\'') && sql.includes('deletion_scheduled_at IS NULL'))).toBe(true)
    expect(tokenRevocations).toEqual([])
    expect(recordedEvents).toEqual([])
    expect(existingDeletionDeadline).toBe('2026-10-20T12:00:00.000Z')
})
