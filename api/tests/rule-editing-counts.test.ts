import { expect, test } from 'bun:test'
import { state, builtin, reply, request, defaultRuleDefinition, getRules, getRule, getRuleHitCounts, getRuleHitCount } from './support/rule-editing-fixture.ts'

test('trigger count includes all saved detections only for this organization and stable rule ID', async () => {
    expect((await getRule(request(), reply() as any)).triggerCount).toBe(0)
    state.findings.push(
        { organizationId: 'org-a', ruleId: builtin, status: 'new', version: '1' },
        { organizationId: 'org-a', ruleId: builtin, status: 'resolved', version: '2' },
        { organizationId: 'other-org', ruleId: builtin },
        { organizationId: 'org-a', ruleId: 'auth.impossible_travel.v1' },
    )
    expect((await getRule(request(), reply() as any)).triggerCount).toBe(2)
    expect((await getRule(request('auth.impossible_travel.v1'), reply() as any)).triggerCount).toBe(1)
})

test('rule hit counts accept the persisted record ID as well as the stable rule ID', async () => {
    state.rows = [{ id: 'rule-record', organization_id: 'org-a', rule_id: builtin, version: '1', name: 'Network signature alert', family: 'Network Detection', severity: 'high', explanation: 'A network alert.', source: 'hanasand', enabled: true, definition: defaultRuleDefinition(builtin) }]
    state.findings.push({ organizationId: 'org-a', ruleId: builtin })
    expect((await getRuleHitCount(request('rule-record'), reply() as any)).triggerCount).toBe(1)
})

test('rule library exposes collector totals and organization-scoped detection hits', async () => {
    state.findings.push({ organizationId: 'org-a', ruleId: builtin, status: 'resolved' }, { organizationId: 'other-org', ruleId: builtin })
    state.rows.push(...['http.routine_access.v1', 'mongodb.cashflow_connections.v1'].map(rule_id => ({ id: rule_id, rule_id, organization_id: 'org-a', source: 'hanasand', definition: { stage: 'analyze', action: 'drop' } })))
    state.rows.push({ id: 'custom-retention', organization_id: 'org-a', rule_id: 'custom.retention.v1', source: 'owned', definition: { stage: 'analyze', action: 'drop' } })
    const result = await getRules(request(), reply() as any)
    const hits = (id: string) => result.rules.find((rule: any) => rule.id === id)?.hitCount
    expect(hits('http.routine_access.v1')).toBe(12345)
    expect(hits('mongodb.cashflow_connections.v1')).toBe(42)
    expect(hits(builtin)).toBe(1)
    expect(hits('auth.impossible_travel.v1')).toBe(0)
    expect(hits('custom.retention.v1')).toBe(0)
    for (const id of ['http.routine_access.v1', 'mongodb.cashflow_connections.v1', builtin, 'auth.impossible_travel.v1', 'custom.retention.v1']) {
        const detail = await getRule(request(id.replace(/\.v\d+$/, '')), reply() as any)
        expect(detail.triggerCount).toBe(hits(id))
    }
    const liveCounts = await getRuleHitCounts(request(), reply() as any)
    expect(liveCounts.hitCounts[builtin]).toBe(1)
    expect(liveCounts.hitCounts['http.routine_access.v1']).toBe(12345)
    expect(liveCounts.hitCounts['custom.retention.v1']).toBe(0)
    const liveDetailCount = await getRuleHitCount(request(builtin), reply() as any)
    expect(liveDetailCount.triggerCount).toBe(1)
    const denied = reply()
    await getRules(request('', {}, 'other-org'), denied as any)
    expect(denied.statusCode).toBe(403)
})

test('Analyze keep hit counts stay hidden across list and detail responses', async () => {
    const id = 'custom.store_keep.v1'
    state.rows.push({
        id: 'custom-store-keep', organization_id: 'org-a', rule_id: id, version: '1',
        name: 'Store without a finding', explanation: 'Retain matching events without creating findings.',
        family: 'Custom', severity: 'low', enabled: true, source: 'owned',
        definition: { stage: 'analyze', action: 'keep', conditions: [{ path: 'event_type', operator: 'equals', value: 'audit' }] },
    })
    state.findings.push({ organizationId: 'org-a', ruleId: id })

    const library = await getRules(request(), reply() as any)
    expect(library.rules.find((rule: any) => rule.id === id).hitCount).toBeNull()
    expect((await getRuleHitCounts(request(), reply() as any)).hitCounts[id]).toBeNull()
    expect((await getRuleHitCount(request(id), reply() as any)).triggerCount).toBeNull()
    expect((await getRule(request(id), reply() as any)).triggerCount).toBeNull()
})

test('compact list returns only selected category and displayed data, keeps details available', async () => {
    state.rows.push({ id: 'custom-retention', organization_id: 'org-a', rule_id: 'custom.retention.v1', version: '1', name: 'Quiet local probe', explanation: 'Store less routine chatter', family: 'Custom', severity: 'low', enabled: true, source: 'owned', definition: { stage: 'analyze', action: 'drop', conditions: [{ path: 'message', operator: 'equals', value: 'not-for-list' }] } })
    const req = request()
    req.query = { organizationId: 'org-a', view: 'list', category: 'analysis' }
    const result = await getRules(req, reply() as any)
    expect(result.rules.some((rule: any) => rule.id === builtin)).toBe(false)
    const rule = result.rules.find((rule: any) => rule.id === 'custom.retention.v1')
    expect(rule.definition).toEqual({ stage: 'analyze', action: 'drop' })
    expect(rule).not.toHaveProperty('evidence')
    expect(rule).not.toHaveProperty('detectionLogic')
    expect(rule).not.toHaveProperty('sourceReference')
    expect(rule.hitCount).toBe(0)
    const detailed = await getRule(request(rule.id), reply() as any)
    expect(detailed.rule.definition.conditions[0].value).toBe('not-for-list')
    const invalid = reply()
    req.query.category = 'unknown'
    await getRules(req, invalid as any)
    expect(invalid.statusCode).toBe(400)
})
