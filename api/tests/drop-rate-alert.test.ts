import { expect, test } from 'bun:test'
import type run from '#db'
import { refreshDropRateAlerts } from '../src/utils/events/dropRateAlert.ts'

test('a pool-unavailable drop rule creates one high alert above 20 receipts per minute', async () => {
    const insertAlerts: Array<Record<string, unknown>[]> = []
    let count = 20
    const query = (async (sql: string, params?: unknown[]) => {
        if (sql.includes('jsonb_to_recordset')) {
            const targets = JSON.parse(String(params?.[0])) as Array<{ conditions: Array<{ value: string }>, min_hits: number, threshold: number }>
            const poolTarget = targets.find(target => target.conditions.some(condition => condition.value === 'Pool currently unavailable, retrying in 5s...'))
            expect(poolTarget?.min_hits).toBe(21)
            expect(poolTarget?.threshold).toBe(20)
            expect(sql).toContain('HAVING count(*) >= target.min_hits')
            return { rows: count >= 21 ? [{ organization_id: 'org', rule_id: 'custom.pool.v1', rule_version: '1',
                bucket: new Date('2026-10-10T12:00:00Z'), hits: String(count), threshold: 20,
                summary: 'Database connection pool repeatedly unavailable', evidence: { service: 'api' } }] : [], rowCount: count >= 21 ? 1 : 0 }
        }
        if (sql.includes('WITH input AS MATERIALIZED')) {
            insertAlerts.push(JSON.parse(String(params?.[0])) as Record<string, unknown>[])
            return { rows: [], rowCount: 1 }
        }
        throw new Error('Unexpected query')
    }) as typeof run

    await refreshDropRateAlerts(query)
    expect(insertAlerts).toHaveLength(0)

    count = 21
    await refreshDropRateAlerts(query)
    expect(insertAlerts).toHaveLength(1)
    const alert = insertAlerts[0][0]
    const normalized = alert.normalized as { severity: string, evidence: Record<string, unknown>, detections: Array<{ severity: string }> }
    expect(normalized.severity).toBe('high')
    expect(normalized.detections[0].severity).toBe('high')
    expect(normalized.evidence.requestCountAtLeast).toBe(21)
    expect(normalized.evidence.threshold).toBe(20)
})
