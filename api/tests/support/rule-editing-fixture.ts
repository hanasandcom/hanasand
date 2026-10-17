import { beforeEach, expect, mock } from 'bun:test'
import { eventProtectionRule, eventProtectionDefinition } from '../../src/utils/events/eventProtection.ts'

export const state = {
    role: 'owner', valid: true, auditFailure: false, systemAdmin: false,
    rows: [] as any[], audits: [] as any[], findings: [] as any[], events: [] as any[],
}
const query = async (sql: string, p: any[] = []): Promise<any> => {
    if (sql.includes('FROM organizations')) return { rows: p[0] === 'org-a' ? [{ role: state.role }] : [] }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] }
    if (sql.includes('FROM rules')) return { rows: state.rows.filter(row => row.organization_id === p[0] && (!sql.includes('rule_id = $2') || row.rule_id === p[1])) }
    if (sql.includes('INSERT INTO rules')) {
        const row = { id: p[0], organization_id: p[1], rule_id: p[2], version: p[3], name: p[4], family: p[5], severity: p[6], explanation: p[7], definition: JSON.parse(p[8]), source: p[9], source_reference: p[10], enabled: p[11] }
        state.rows = [...state.rows.filter(old => old.id !== row.id), row]
        return { rows: [row] }
    }
    if (sql.includes('INSERT INTO system_events')) {
        if (state.auditFailure) throw new Error('Audit unavailable')
        state.audits.push({ id: String(state.audits.length), event_type: p[0], actor_id: p[4], object_type: p[5], object_id: p[6], organization_id: p[7], context: JSON.parse(p[12]), created_at: '2026-09-14T12:00:00Z' })
        return { rows: [] }
    }
    if (sql.includes('FROM rule_hit_counts')) {
        expect(p[0]).toBe('org-a')
        const findingIds = p[1] as string[]
        const receiptIds = p[2] as string[]
        const totals = new Map<string, number>()
        for (const finding of state.findings.filter(row => row.organizationId === p[0] && findingIds.includes(row.ruleId))) totals.set(finding.ruleId, (totals.get(finding.ruleId) || 0) + 1)
        const result = [...totals].map(([rule_id, hits]) => ({ rule_id, hits: String(hits) }))
        for (const rule_id of receiptIds) result.push({ rule_id, hits: '0' })
        if (p.includes('http.routine_access.v1')) result.push({ rule_id: 'http.routine_access.v1', hits: '12345' })
        if (p.includes('mongodb.cashflow_connections.v1')) result.push({ rule_id: 'mongodb.cashflow_connections.v1', hits: '42' })
        return { rows: result }
    }
    if (sql.includes('SELECT count(*)::text AS count FROM findings')) return { rows: [{ count: String(state.findings.filter(row => row.organizationId === p[0] && row.ruleId === p[1]).length) }] }
    if (sql.includes('context->\'after\'->>\'version\'')) return { rows: state.audits.filter(row => row.organization_id === p[0] && row.object_id === p[1] && (row.context.after?.version === p[3] || row.context.before?.version === p[3])).slice(-1) }
    if (sql.includes('FROM system_events')) return { rows: state.audits.filter(row => row.organization_id === p[0] && (row.object_id === p[1] || row.object_id === p[2])).slice(p[3], p[3] + 51) }
    if (sql.includes('INSERT INTO events')) {
        state.events.push({ id: p[0], organization_id: p[2], event_timestamp: p[5], event_type: p[6], action: p[7], outcome: p[8], user_id: p[9], source_ip: p[11], normalized: JSON.parse(p[15]) })
        return { rows: [] }
    }
    if (sql.includes('UPDATE events')) return { rows: [] }
    if (sql.trimStart().startsWith('SELECT') && sql.includes('FROM events')) {
        const result = state.events.filter(row => row.organization_id === p[0] && (sql.includes('source_ip = $2') ? row.source_ip === p[1] : row.user_id === p[1]) && row.id !== p[2] && row.event_type === 'authentication' && row.action === 'login' && Date.parse(row.event_timestamp) <= Date.parse(p[3]))
            .sort((a, b) => Date.parse(b.event_timestamp) - Date.parse(a.event_timestamp))
        return { rows: sql.includes('INTERVAL \'1 minute\'') ? result.filter(row => row.outcome === 'failure' && Date.parse(row.event_timestamp) >= Date.parse(p[3]) - p[4] * 60000) : result.slice(0, p[4]) }
    }
    if (sql.includes('INSERT INTO findings')) { state.findings.push(...JSON.parse(p[0]).map((item: any) => ({ organizationId: item.organization_id, ruleId: item.rule_id, severity: item.severity, evidence: item.evidence }))); return { rows: [] } }
    if (sql.includes('INSERT INTO log_analyze_receipts')) return { rows: [] }
    throw new Error(`Unexpected query: ${sql}`)
}
mock.module('#db', () => ({ default: query, identityQueryOnce: query, isTransientDatabaseError: () => false, withTransaction: async (work: any) => {
    const beforeRows = structuredClone(state.rows), beforeAudit = structuredClone(state.audits)
    try { return await work(query) } catch (error) { state.rows = beforeRows; state.audits = beforeAudit; throw error }
} }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: state.valid, id: 'editor' }) }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: state.systemAdmin }), hasHanasandInternalRouteAccess: async () => ({ valid: state.systemAdmin }) }))
mock.module('#utils/auth/apiKeys.ts', () => ({ validateApiKey: async () => ({ organizationId: 'org-a', apiKey: { scopes: [] } }), matchApiKeyScope: () => true }))
export const { defaultRuleDefinition, normalizeBuiltinDefinition, postRulePreview, getRules, getRule, getRuleHitCounts, getRuleHitCount, putRule, postRuleAction, postRule, postRulePack, postEventSigmaPack, ingestEvent } = await import('../../src/handlers/events.ts')
beforeEach(() => {
    state.rows = []
    state.audits = []
    state.findings = []
    state.events = []
    state.role = 'owner'
    state.valid = true
    state.auditFailure = false
    state.systemAdmin = false
})
export { eventProtectionRule, eventProtectionDefinition }
export const builtin = 'network.signature_alert.v1'
export const reply = () => ({ statusCode: 200, status(code: number) { this.statusCode = code; return this }, header() { return this }, send(body: any) { return body } })
export const request = (id = builtin.replace(/\.v\d+$/, ''), body: any = {}, organizationId = 'org-a') => ({ params: { id }, query: { organizationId }, body, ip: '127.0.0.1', headers: { authorization: 'Bearer test-key' }, id: 'request-test' }) as any
export const edit = { version: '1', name: 'Custom network alert', explanation: 'An important signature matched a network event.', severity: 'critical', enabled: true }
export const network = { source: {}, events: [{ timestamp: '2026-09-14T12:00:00Z', event_type: 'network', action: 'alert', signature: 'Test signature' }] }

