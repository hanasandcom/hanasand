import { beforeEach, expect, mock, test } from 'bun:test'
let findings: any[] = [], previous: any[] = [], historyQueries = 0, findingWrites = 0
const historyReads: Array<{ sql: string, params: any[] }> = []
const query = async (sql: string, p: any[] = []) => {
    if (sql.trimStart().startsWith('SELECT') && sql.includes('FROM events')) { historyQueries++; historyReads.push({ sql, params: p }); return { rows: previous } }
    if (sql.includes('INSERT INTO findings')) { findingWrites++; findings.push(...JSON.parse(p[0]).map((item: any) => ({ ...item, id: item.rule_id }))); return { rows: [] } }
    throw new Error(sql)
}
mock.module('#db', () => ({ default: query, identityQueryOnce: query, isTransientDatabaseError: () => false, withTransaction: async (work: any) => work(query) }))
const { createFindings, BUILTIN_RULES, normalizeEvent, defaultRuleDefinition } = await import('../src/handlers/events.ts')
const rules = BUILTIN_RULES.filter(rule => ['auth.new_country.v1', 'auth.new_device.v1'].includes(rule.id)).map(rule => ({ ...rule, source: 'hanasand' as const, definition: defaultRuleDefinition(rule.id) }))
beforeEach(() => { findings = []; historyQueries = 0; historyReads.length = 0; findingWrites = 0; previous = [ { id: 'recent', outcome: 'success', source_country: 'US', normalized: { device: { id: 'two' } } }, { id: 'older', outcome: 'success', source_country: 'NO', normalized: { device: { id: 'one' } } } ] })
const event = (country: string, device: string, userId: string | null = 'alice') => normalizeEvent({ timestamp: '2026-09-19T00:00:00Z', event_type: 'authentication', action: 'login', outcome: 'success', user: { id: userId }, source: { country }, device: { id: device } }, {})
test('returning to a known country and device does not create new-value findings', async () => {
    await createFindings('org-a', 'current', event('NO', 'one'), rules)
    expect(findings).toHaveLength(0)
})
test('unseen country and device produce both findings when known history exists', async () => {
    await createFindings('org-a', 'current', event('GB', 'three'), rules)
    expect(findings.map(row => row.id)).toEqual(['auth.new_country.v1', 'auth.new_device.v1'])
    expect(findingWrites).toBe(1)
    expect(historyReads).toHaveLength(1)
    expect(historyReads[0].params).toEqual(['org-a', 'alice', 'current', '2026-09-19T00:00:00.000Z', 30])
    const historySql = historyReads[0].sql.replace(/\s+/g, ' ')
    expect(historySql).toContain('WHERE organization_id = $1 AND user_id = $2 AND id <> $3')
    expect(historySql).toContain('event_type = \'authentication\' AND action = \'login\' AND event_timestamp <= $4::timestamptz')
    expect(historySql).toContain('ORDER BY event_timestamp DESC LIMIT $5')
    expect(findings).toMatchObject([
        { organization_id: 'org-a', severity: 'medium', event_ids: ['current', 'recent'], evidence: { currentCountry: 'GB', previousCountry: 'US', ruleVersion: '1' } },
        { organization_id: 'org-a', severity: 'medium', event_ids: ['current', 'recent'], evidence: { currentDevice: 'three', previousDevice: 'two', ruleVersion: '1' } },
    ])
})

test('skips history reads when historical rules are disabled', async () => {
    const disabledRules = rules.map(rule => ({ ...rule, enabled: false }))
    await createFindings('org-a', 'current', event('GB', 'three'), disabledRules)
    expect(historyQueries).toBe(0)
    expect(findings).toHaveLength(0)
})

test('does not query user history when a login has no user ID', async () => {
    await createFindings('org-a', 'current', event('GB', 'three', null), rules)
    expect(historyQueries).toBe(0)
    expect(findings).toHaveLength(0)
})
