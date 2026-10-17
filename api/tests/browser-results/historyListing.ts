import { expect, test } from 'bun:test'
import { handlers, response, state } from './fixture.ts'

test('full history includes repeated URLs, paginates and keeps client ownership filtering', async () => {
    state.userId = ''
    for (const offset of ['0', '50']) {
        const res = response()
        await handlers.getBrowserRuns({ query: { clientId: 'history-test-client', history: 'all', offset }, log: { error: console.error } } as any, res as any)
        expect(res.code).toBe(200)
        expect(res.body.runs).toHaveLength(offset === '0' ? 50 : 2)
        expect(res.body.nextOffset).toBe(offset === '0' ? 50 : null)
        expect(state.historyQuery!.sql).toContain('WHERE client_id_hash = $1')
        expect(state.historyQuery!.sql).not.toContain('DISTINCT')
        expect(state.historyQuery!.params[0]).not.toBe('history-test-client')
    }
    const invalid = response()
    await handlers.getBrowserRuns({ query: { clientId: 'history-test-client', history: 'all', offset: '-1' }, log: { error: console.error } } as any, invalid as any)
    expect(invalid.code).toBe(400)
})

test('latest runs use the same bounded query with owner or client scope', async () => {
    const clientId = 'latest-test-client'
    for (const identity of [
        { userId: 'owner', scope: '(owner_id = $1 OR ($2::text IS NOT NULL AND client_id_hash = $2))' },
        { userId: '', scope: 'client_id_hash = $1' },
    ]) {
        state.userId = identity.userId
        const res = response()
        await handlers.getBrowserRuns({ query: { clientId }, log: { error: console.error } } as any, res as any)
        expect(res.code).toBe(200)
        expect(state.latestRunsQuery!.sql).toContain(`WHERE ${identity.scope}`)
        expect(state.latestRunsQuery!.sql).toContain('AND metadata->>\'historyDeletedAt\' IS NULL')
        expect(state.latestRunsQuery!.sql).toContain('metadata - \'report\' AS metadata')
        expect(state.latestRunsQuery!.sql).toContain('ORDER BY result_id, created_at DESC')
        expect(state.latestRunsQuery!.sql).toContain('ORDER BY created_at DESC\n            LIMIT 12')
        if (identity.userId) {
            expect(state.latestRunsQuery!.params[0]).toBe(identity.userId)
            expect(typeof state.latestRunsQuery!.params[1]).toBe('string')
        } else {
            expect(state.latestRunsQuery!.params).toHaveLength(1)
            expect(typeof state.latestRunsQuery!.params[0]).toBe('string')
        }
        expect(state.latestRunsQuery!.params).not.toContain(clientId)
    }
})
