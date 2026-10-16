import { expect, test } from 'bun:test'
import { ingestionCopy, ingestionDefinition } from '../src/utils/events/analyzeIngestion.ts'
import { matchesAnalysisPolicy } from '../src/utils/events/analysisPolicy.ts'
import { normalizeLogEvent } from '../src/utils/events/logEvent.ts'
import { fixture } from './analyze-ingestion-fixtures.ts'

test('only identical complete records share a correlation key; bodies and provenance are recoverable', () => {
    const first = fixture(), copy = structuredClone(first)
    copy.sourceEventId = 'c'.repeat(64)
    copy.timestamp = '2026-09-24T00:00:01.000Z'
    copy.service = 'hanasand-api-2'
    expect(ingestionCopy(copy)?.key).toBe(ingestionCopy(first)?.key)
    const compact = ingestionCopy(copy)!
    expect({ ...JSON.parse(JSON.stringify(compact.envelope)), message: first.message,
        metadata: { ...compact.envelope.metadata, structured: first.metadata.structured } }).toEqual(copy)
    copy.metadata.structured.req.body.events[0].message = 'different submitted content'
    copy.message = JSON.stringify(copy.metadata.structured)
    expect(ingestionCopy(copy)?.key).not.toBe(ingestionCopy(first)?.key)
})

test('status or path alone never authorizes a drop; unknown evidence, warnings and failures stay', async () => {
    const eligible = async (log: ReturnType<typeof fixture>) => Boolean(ingestionCopy(log))
        && await matchesAnalysisPolicy([normalizeLogEvent({ ...log, id: log.sourceEventId, created_at: log.timestamp })], ingestionDefinition)
    expect(await eligible(fixture())).toBe(true)
    for (const change of [{ level: 'warn' }, { level: 'error' }, { service: 'untrusted' }, { host: 'unknown' }, { sourceEventId: '' }, { extra: 'keep' }]) {
        expect(await eligible({ ...fixture(), ...change } as any)).toBe(false)
    }
    for (const mutate of [
        (x: any) => { x.metadata.extra = 'keep' },
        (x: any) => { x.metadata.structured.extra = 'keep' },
        (x: any) => { x.metadata.structured.access.status = 200 },
        (x: any) => { x.metadata.structured.access.status = 401 },
        (x: any) => { x.metadata.structured.req.url += '?extra=1' },
        (x: any) => { x.metadata.structured.reqId = 'missing' },
        (x: any) => { delete x.metadata.structured.access },
    ]) {
        const log = fixture(); mutate(log); log.message = JSON.stringify(log.metadata.structured)
        expect(await eligible(log)).toBe(false)
    }
    const duplicateKey = fixture()
    duplicateKey.message = duplicateKey.message.replace('"level":30', '"level":50,"level":30')
    expect(ingestionCopy(duplicateKey)).toBeNull()
})
