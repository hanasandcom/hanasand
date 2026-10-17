import { expect, test } from 'bun:test'

type Context = {
    processLogBatch: (...args: any[]) => Promise<unknown>
    rules: () => any[]
    setRetentionRules: (rules: any[]) => void
    setFailReceiptWrite: (value: boolean) => void
    deletedLogins: () => string[]
    receipts: () => unknown[][]
    stored: () => Record<string, any>
    pendingLookups: () => number
    completedLookups: () => number
    authRechecks: () => Array<{ sql: string, params: any[] }>
}

export function registerEventProcessingAuthScenarios(fixture: Context) {
    test('login events keep their pending correlation lookup', async () => {
        const login = { id: 'login', service: 'sshd', host: 'inspur', level: 'info', message: 'Accepted password for alice from 192.0.2.1', created_at: '2026-09-19T10:00:00Z' }
        await fixture.processLogBatch([login], 'org-a', [])
        expect(fixture.pendingLookups()).toBe(1); expect(fixture.completedLookups()).toBe(1)
        expect(Object.values(fixture.stored())[0].processing_status).toBe('processed')
    })

    test('a successful matching login-monitor source is dropped before auth correlation', async () => {
        const { authenticationAuditStoreRule } = await import('../../src/utils/events/eventProtection.ts')
        fixture.setRetentionRules([
            { id: authenticationAuditStoreRule.id, organization_id: 'org-a', version: '1', source: 'owned', enabled: true, definition: authenticationAuditStoreRule.definition },
            { id: 'custom.login-monitor.v1', organization_id: 'org-a', version: '1', source: 'owned', enabled: true,
                definition: { stage: 'analyze', action: 'drop', conditions: [
                    { path: 'user.id', operator: 'regex', value: '^login_monitor' },
                    { path: 'source.ip', operator: 'equals', value: '127.0.0.1' },
                    { path: 'metadata.user_agent', operator: 'regex', value: '^Bun/' },
                    { path: 'outcome', operator: 'equals', value: 'success' },
                ] } },
        ])
        const login = { id: 'login_events:2756', service: 'hanasand-auth', host: 'hanasand.com', level: 'info',
            message: 'Successful sign-in', created_at: '2026-07-03T02:18:39Z', metadata: { category: 'authentication', action: 'login', outcome: 'success',
                user: { id: 'login_monitor_20260703021420' }, source: { ip: '127.0.0.1' }, user_agent: 'Bun/1.2.3' } }
        await fixture.processLogBatch([login], 'org-a', [])
        expect(fixture.deletedLogins()).toEqual(['2756'])
        expect(fixture.receipts()).toHaveLength(1)
        expect(fixture.stored()).toEqual({})
        expect(fixture.pendingLookups()).toBe(0)
    })

    test('login-monitor receipt failure rolls back the earlier source deletion', async () => {
        const { authenticationAuditStoreRule } = await import('../../src/utils/events/eventProtection.ts')
        fixture.setRetentionRules([
            { id: authenticationAuditStoreRule.id, organization_id: 'org-a', version: '1', source: 'owned', enabled: true, definition: authenticationAuditStoreRule.definition },
            { id: 'custom.login-monitor.v1', organization_id: 'org-a', version: '1', source: 'owned', enabled: true,
                definition: { stage: 'analyze', action: 'drop', conditions: [
                    { path: 'user.id', operator: 'regex', value: '^login_monitor' },
                    { path: 'source.ip', operator: 'equals', value: '127.0.0.1' },
                    { path: 'metadata.user_agent', operator: 'regex', value: '^Bun/' },
                    { path: 'outcome', operator: 'equals', value: 'success' },
                ] } },
        ])
        const login = { id: 'login_events:2756', service: 'hanasand-auth', host: 'hanasand.com', level: 'info',
            message: 'Successful sign-in', created_at: '2026-07-03T02:18:39Z', metadata: { category: 'authentication', action: 'login', outcome: 'success',
                user: { id: 'login_monitor_20260703021420' }, source: { ip: '127.0.0.1' }, user_agent: 'Bun/1.2.3' } }
        fixture.setFailReceiptWrite(true)

        await expect(fixture.processLogBatch([login], 'org-a', [])).rejects.toThrow('Receipt storage failed')
        expect(fixture.deletedLogins()).toEqual([])
        expect(fixture.receipts()).toHaveLength(0)
        expect(fixture.stored()).toEqual({})
    })

    test('late authentication rechecks use bounded user and source-IP index lanes', async () => {
        const login = { id: 'late-login', service: 'sshd', host: 'inspur', level: 'info', message: 'Failed password for alice from 192.0.2.1', created_at: '2026-09-19T10:00:00Z' }
        await fixture.processLogBatch([login], 'org-a', fixture.rules())
        expect(fixture.authRechecks()).toHaveLength(1)
        const { sql, params } = fixture.authRechecks()[0]
        expect(params[1]).toBe('inspur:alice')
        expect(params[2]).toBe('192.0.2.1')
        expect(params[3]).toBe('failure')
        expect(params[6]).toBe(25)
        expect(sql).toContain('e.user_id = $2')
        expect(sql).toContain('md5(e.source_ip) = md5($3::text)')
        expect(sql).toContain('$4 = \'failure\'')
        expect(sql).toContain('e.outcome = \'success\'')
        expect(sql).toContain('LIMIT $7')
        expect(sql).not.toContain(' OR e.source_ip')
        expect(sql).not.toContain('OFFSET')
    })
}
