import { expect, mock, test } from 'bun:test'

type CdnIngestContract = {
    feature: string
    analyze: (event: any, query: any) => Promise<boolean>
    ruleId: string
    definition: any
    fixture: () => any
}

export function mockCdnIngestDependencies() {
    mock.module('#constants', () => ({ default: {} }))
    const unexpectedQuery = async () => { throw new Error('unexpected database access') }
    mock.module('#db', () => ({ default: unexpectedQuery, identityQueryOnce: unexpectedQuery, isTransientDatabaseError: () => false, withTransaction: async (fn: () => unknown) => fn(), withReadDatabase: async (fn: () => unknown) => fn() }))
}

export function registerCdnIngestContract({ feature, analyze, ruleId, definition, fixture }: CdnIngestContract) {
    test(`${feature}: only enabled Drop rules admit receipts; suspicious or incomplete events never reach the database`, async () => {
        for (const enabled of [false, true]) {
            const statements: string[] = []
            const query: any = async (sql: string, params: unknown[]) => {
                statements.push(sql)
                if (sql.includes('WHERE organization_id = $1') || sql.includes('r.source=\'owned\'')) return { rows: [] }
                if (sql.includes('FROM rules')) {
                    expect(sql).toContain('r.enabled AND r.definition->>\'stage\'=\'analyze\' AND r.definition->>\'action\'=\'drop\'')
                    expect(params[1]).toBe(ruleId)
                    return { rows: enabled ? [{ organization_id: 'platform', version: '1', definition }] : [] }
                }
                return { rows: [], rowCount: 1 }
            }
            expect(await analyze(fixture(), query)).toBe(enabled)
            expect(statements.some(sql => sql.includes('INSERT INTO log_analyze_receipts'))).toBe(enabled)
        }

        let called = false
        const query: any = async () => { called = true; throw new Error('must not query') }
        expect(await analyze({ ...fixture(), message: 'unexpected suspicious text' }, query)).toBe(false)
        expect(called).toBe(false)
    })

    test(`${feature}: receipt failure prevents acknowledgement; replay uses stable idempotent receipt`, async () => {
        const params: unknown[][] = []
        const query: any = async (sql: string, values: unknown[]) => {
            if (sql.includes('WHERE organization_id = $1') || sql.includes('r.source=\'owned\'')) return { rows: [] }
            if (sql.includes('FROM rules')) return { rows: [{ organization_id: 'platform', version: '1', definition }] }
            expect(sql).toContain('ON CONFLICT DO NOTHING')
            params.push(values)
            return { rows: [], rowCount: params.length === 1 ? 1 : 0 }
        }
        expect(await analyze(fixture(), query)).toBe(true)
        expect(await analyze(fixture(), query)).toBe(true)
        expect(params[0]).toEqual(params[1])

        const failing: any = async (sql: string) => {
            if (sql.includes('WHERE organization_id = $1') || sql.includes('r.source=\'owned\'')) return { rows: [] }
            if (sql.includes('FROM rules')) return { rows: [{ organization_id: 'platform', version: '1', definition }] }
            throw new Error('receipt failed')
        }
        await expect(analyze(fixture(), failing)).rejects.toThrow('receipt failed')
    })

    test(`${feature}: a configured finding blocks the drop receipt`, async () => {
        const event = fixture()
        const statements: string[] = []
        const configuredDetector = {
            id: 'cdn.protect',
            version: '1',
            name: 'Protect CDN evidence',
            family: 'test',
            severity: 'high',
            explanation: 'Preserve matching CDN evidence.',
            source: 'owned',
            enabled: true,
            definition: { stage: 'detect', conditions: [{ path: 'message', operator: 'equals', value: event.message }] },
        }
        const query: any = async (sql: string) => {
            statements.push(sql)
            if (sql.includes('JOIN organizations o')) return { rows: [{ organization_id: 'platform', version: '1', definition }] }
            if (sql.includes('JOIN organizations scope')) return { rows: [] }
            if (sql.includes('FROM rules') && sql.includes('WHERE organization_id = $1')) return { rows: [configuredDetector] }
            if (sql.includes('INSERT INTO log_analyze_receipts')) throw new Error('protected event must not get a receipt')
            return { rows: [], rowCount: 1 }
        }

        expect(await analyze(event, query)).toBe(false)
        expect(statements.some(sql => sql.includes('INSERT INTO log_analyze_receipts'))).toBe(false)
    })
}
