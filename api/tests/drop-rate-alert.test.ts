import { expect, test } from 'bun:test'
import type run from '#db'
import { refreshDropRateAlerts } from '../src/utils/events/dropRateAlert.ts'

test('a pool-unavailable drop rule creates one high alert above 20 receipts per minute', async () => {
    const insertAlerts: Array<Record<string, unknown>[]> = []
    let count = 20
    const query = (async (sql: string, params?: unknown[]) => {
        if (sql.includes('WITH patterns AS')) {
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

test('HTTP rate alerts use narrow selectors and create case-deliverable high events above 10 per minute', async () => {
    const insertCalls: Array<{ sql: string, alerts: Array<Record<string, unknown>> }> = []
    let count = 10
    const query = (async (sql: string, params?: unknown[]) => {
        if (sql.includes('WITH patterns AS')) {
            const targets = JSON.parse(String(params?.[0])) as Array<{
                conditions: Array<{ path: string, value: string }>, min_hits: number, threshold: number, summary: string, evidence: Record<string, unknown>
            }>
            const postUser = targets.find(target => target.conditions.some(condition => condition.value === 'POST /api/user → 201'))
            const dockerUnauthorized = targets.find(target => target.conditions.some(condition => condition.value === 'GET /api/docker failed with 401 unauthorized.'))
            expect(postUser?.min_hits).toBe(11)
            expect(postUser?.threshold).toBe(10)
            expect(postUser?.conditions).toContainEqual({ path: 'metadata.user_agent', operator: 'equals', value: 'Bun/1.3.13', caseSensitive: true })
            expect(dockerUnauthorized?.min_hits).toBe(11)
            expect(dockerUnauthorized?.threshold).toBe(10)
            expect(dockerUnauthorized?.conditions).toContainEqual({ path: 'metadata.user_agent', operator: 'equals', value: 'hanasand_internal', caseSensitive: true })
            expect(dockerUnauthorized?.conditions.some(condition => condition.value.includes('Safari'))).toBe(false)
            return { rows: count >= 11 ? [postUser, dockerUnauthorized].map((target, index) => ({
                organization_id: 'org', rule_id: `custom.http-${index}.v1`, rule_version: '1',
                bucket: new Date('2026-10-10T12:00:00Z'), hits: String(count), threshold: 10,
                summary: target!.summary, evidence: target!.evidence,
            })) : [], rowCount: count >= 11 ? 2 : 0 }
        }
        if (sql.includes('WITH input AS MATERIALIZED')) {
            insertCalls.push({ sql, alerts: JSON.parse(String(params?.[0])) as Array<Record<string, unknown>> })
            return { rows: [], rowCount: 2 }
        }
        throw new Error('Unexpected query')
    }) as typeof run

    await refreshDropRateAlerts(query)
    expect(insertCalls).toHaveLength(0)

    count = 11
    await refreshDropRateAlerts(query)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].sql).toContain('SELECT item.event_id,\'drop-rate-alerts\'')
    for (const alert of insertCalls[0].alerts) {
        const normalized = alert.normalized as { severity: string, evidence: Record<string, unknown>, detections: Array<{ severity: string }> }
        expect(normalized.severity).toBe('high')
        expect(normalized.detections[0].severity).toBe('high')
        expect(normalized.evidence.requestCountAtLeast).toBe(11)
        expect(normalized.evidence.threshold).toBe(10)
    }
})
