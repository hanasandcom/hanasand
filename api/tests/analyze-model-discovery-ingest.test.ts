import { expect, mock, test } from 'bun:test'
import { modelHealthDefinition, modelHealthRuleId } from '../src/utils/events/analyzeModelDiscovery.ts'
import { modelFixture, testKey } from './support/model-discovery-fixture.ts'

const statements: string[] = []
const configuredDetector = {
    id: 'model.protect',
    version: '1',
    name: 'Protect model evidence',
    family: 'test',
    severity: 'high',
    explanation: 'Preserve matching model evidence.',
    source: 'owned',
    enabled: true,
    definition: { stage: 'detect', conditions: [{ path: 'host', operator: 'equals', value: 'inspur' }] },
}

mock.module('#constants', () => ({ default: {} }))
mock.module('#db', () => {
    const query = async (sql: string, values?: unknown[]) => {
        statements.push(sql)
        if (sql.includes('JOIN organizations o')) return { rows: [{ organization_id: 'platform', version: '1', definition: values?.[1] === modelHealthRuleId ? modelHealthDefinition : { stage: 'analyze', action: 'drop', conditions: [] } }] }
        if (sql.includes('JOIN organizations scope')) return { rows: [] }
        if (sql.includes('FROM rules') && sql.includes('WHERE organization_id = $1')) return { rows: [configuredDetector] }
        if (sql.includes('INSERT INTO log_model_probe_receipts')) throw new Error('protected model evidence must not get a receipt')
        return { rows: [], rowCount: 1 }
    }
    return { default: query, identityQueryOnce: query, isTransientDatabaseError: () => false, withTransaction: async (work: (query: typeof query) => unknown) => work(query) }
})

const { analyzeModelDiscovery } = await import('../src/utils/events/analyzeModelDiscoveryLog.ts')
const { analyzeModelHealthCheck } = await import('../src/utils/events/analyzeModelDiscoveryLog.ts')

test('a configured finding protects verified model evidence from the drop receipt', async () => {
    statements.length = 0
    const previousKey = process.env.MODEL_PROBE_PROOF_KEY
    process.env.MODEL_PROBE_PROOF_KEY = testKey
    try {
        expect(await analyzeModelDiscovery(modelFixture())).toBe(false)
        expect(statements.some(sql => sql.includes('INSERT INTO log_model_probe_receipts'))).toBe(false)
    } finally {
        if (previousKey === undefined) delete process.env.MODEL_PROBE_PROOF_KEY
        else process.env.MODEL_PROBE_PROOF_KEY = previousKey
    }
})

test('a configured finding protects model health checks from the drop receipt', async () => {
    statements.length = 0
    const log = {
        host: 'inspur',
        service: 'run_model_inspur_vllm_gpu.sh',
        level: 'info',
        sourceEventId: 'f'.repeat(64),
        timestamp: '2026-09-24T00:00:00.000Z',
        message: '(APIServer pid=1143552) INFO: 127.0.0.1:34764 - "GET /v1/models HTTP/1.1" 200 OK',
        metadata: {},
    }

    expect(await analyzeModelHealthCheck(log)).toBe(false)
    expect(statements.some(sql => sql.includes('INSERT INTO log_analyze_receipts'))).toBe(false)
})
