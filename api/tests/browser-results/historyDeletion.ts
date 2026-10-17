import { expect, test } from 'bun:test'
import { handlers, response, state } from './fixture.ts'

test('anonymous selected deletion keeps client scope before run IDs', async () => {
    state.userId = ''
    const res = response()
    await handlers.deleteBrowserRuns({ body: { clientId: 'anonymous-client-123', ids: ['979b6683-b76b-87fc-95e8-02baa94ae619'] }, log: { error: console.error } } as any, res as any)

    expect(res.code).toBe(200)
    expect(state.deleteQuery!.sql).toContain('id = ANY($2::uuid[]) AND client_id_hash = $1')
    expect(state.deleteQuery!.sql).toContain('WHERE client_id_hash = $1')
    expect(state.deleteQuery!.params).toHaveLength(2)
    expect(state.deleteQuery!.params[1]).toEqual(['979b6683-b76b-87fc-95e8-02baa94ae619'])
})

test('missing history identity keeps the distinct GET and DELETE responses', async () => {
    state.userId = ''
    const listed = response()
    await handlers.getBrowserRuns({ query: { clientId: 'short' }, log: { error: console.error } } as any, listed as any)
    expect(listed.code).toBe(200)
    expect(listed.body).toEqual({
        runs: [],
        quota: {
            plan: 'anonymous', limit: null, used: 0, remaining: null, active: 0,
            paid: false, concurrentLimit: 1, sessionSeconds: 90, advancedAnalysis: false,
            resetsAt: null, identityKind: 'anonymous',
        },
    })

    const deleted = response()
    await handlers.deleteBrowserRuns({ body: { clientId: 'short', clear: true }, log: { error: console.error } } as any, deleted as any)
    expect(deleted.code).toBe(400)
    expect(deleted.body).toEqual({ error: 'A browser history identity is required.' })
    expect(state.deleteQuery).toBeNull()
})

test('deleting a selected run hides every saved version of its result without removing usage rows', async () => {
    const res = response()
    await handlers.deleteBrowserRuns({ body: { clientId: 'history-test-client', ids: ['979b6683-b76b-87fc-95e8-02baa94ae619'] }, log: { error: console.error } } as any, res as any)
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ deleted: 2 })
    expect(state.deleteQuery!.sql).toContain('SELECT DISTINCT result_id FROM browser_runs')
    expect(state.deleteQuery!.sql).toContain('jsonb_build_object(\'historyDeletedAt\', NOW())')
    expect(state.deleteQuery!.sql).not.toContain('DELETE FROM browser_runs')
    expect(state.deleteQuery!.params[0]).toBe('owner')
    expect(state.deleteQuery!.params[2]).toEqual(['979b6683-b76b-87fc-95e8-02baa94ae619'])
})

test('clear history is scoped to the signed-in owner and rejects empty selection requests', async () => {
    const cleared = response()
    await handlers.deleteBrowserRuns({ body: { clientId: 'history-test-client', clear: true }, log: { error: console.error } } as any, cleared as any)
    expect(cleared.code).toBe(200)
    expect(state.deleteQuery!.sql).toContain('(owner_id = $1 OR ($2::text IS NOT NULL AND client_id_hash = $2))')
    expect(state.deleteQuery!.sql).toContain('metadata->>\'historyDeletedAt\' IS NULL')

    const invalid = response()
    await handlers.deleteBrowserRuns({ body: { clientId: 'history-test-client', ids: [] }, log: { error: console.error } } as any, invalid as any)
    expect(invalid.code).toBe(400)
})
