import { expect, test } from 'bun:test'
import { state, eventProtectionRule, eventProtectionDefinition, builtin, reply, request, edit, network, getRule, putRule, postRuleAction, postRule, ingestEvent } from './support/rule-editing-fixture.ts'

test('custom Analyze rules drop before storage and retain audited Store exceptions', async () => {
    const benign = { source: {}, events: [{ timestamp: '2026-09-14T12:00:00Z', event_type: 'network', action: 'heartbeat', severity: 'low' }] }
    const body = { name: 'Drop network noise', explanation: 'Discard matching routine network events.', severity: 'critical', stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'network' }] }
    const denied = reply()
    await postRule(request('', body), denied as any)
    expect(denied.statusCode).toBe(403)
    state.systemAdmin = true
    const created = await postRule(request('', body), reply() as any)
    expect(created.rule.severity).toBe('critical')
    expect(created.rule.definition).toMatchObject({ stage: 'analyze', action: 'drop' })
    state.rows.push({ ...eventProtectionRule, rule_id: eventProtectionRule.id, organization_id: 'org-a', source: 'hanasand', definition: structuredClone(eventProtectionDefinition) })
    expect(await ingestEvent(request('', benign), reply() as any)).toMatchObject({ accepted_events: 1, stored_events: 0, dropped_events: 1 })
    expect(state.events).toHaveLength(0)
    expect(state.findings).toHaveLength(0)
    expect(await ingestEvent(request('', { ...network, events: network.events.map(event => ({ ...event, severity: 'low' })) }), reply() as any)).toMatchObject({ stored_events: 1, dropped_events: 0 })
    expect(state.findings.some(finding => finding.ruleId === builtin)).toBe(true)
    await putRule(request(created.rule.id, { ...body, enabled: true, version: '1', action: 'keep' }), reply() as any)
    expect(state.rows[0].definition).toMatchObject({ stage: 'analyze', action: 'keep' })
    expect(state.audits.at(-1).context.after.definition.action).toBe('keep')
    expect(await ingestEvent(request('', benign), reply() as any)).toMatchObject({ stored_events: 1, dropped_events: 0 })
    expect(state.findings.some(finding => finding.ruleId === created.rule.id)).toBe(false)
    await postRule(request('', body), reply() as any)
    expect((await ingestEvent(request('', benign), reply() as any)).dropped_events).toBe(0)
    const outside = reply()
    await postRule(request('', body, 'org-b'), outside as any)
    expect(outside.statusCode).toBe(403)
})

test('custom action validation and disabling restores storage', async () => {
    state.systemAdmin = true
    const body = { name: 'Drop network', explanation: 'Discard network events matching this selector.', severity: 'low', stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'network' }] }
    for (const change of [{ stage: 'match' }, { stage: 'invalid' }, { action: 'invalid' }, { conditions: [] }]) {
        const result = reply()
        await postRule(request('', { ...body, ...change }), result as any)
        expect(result.statusCode).toBe(400)
    }
    const created = await postRule(request('', body), reply() as any)
    await postRuleAction(request(created.rule.id, { action: 'disable' }), reply() as any)
    expect((await ingestEvent(request('', network), reply() as any)).dropped_events).toBe(0)
})

test('Drop rule severity metadata is independent from matched event severity', async () => {
    state.systemAdmin = true
    const body = { name: 'Drop low network events', explanation: 'Drop only routine low severity network events.', severity: 'critical', stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'network' }] }
    const created = await postRule(request('', body), reply() as any)
    const saved = await putRule(request(created.rule.id, { ...body, severity: 'high', version: created.rule.version, enabled: true }), reply() as any)
    expect(saved.rule.severity).toBe('high')
    const dropEvent = { source: {}, events: [{ timestamp: '2026-09-14T12:00:00Z', event_type: 'network', action: 'heartbeat' }] }
    for (const severity of ['low', 'medium', 'high', 'critical', undefined]) {
        const result = await ingestEvent(request('', { ...dropEvent, events: dropEvent.events.map(event => ({ ...event, severity })) }), reply() as any)
        expect(result).toMatchObject({ stored_events: 0, dropped_events: 1 })
    }
})

test('Drop and Store rules retain their configured severity metadata', async () => {
    state.systemAdmin = true
    const created = await postRule(request('', { name: 'Old drop rule', explanation: 'An older rule that dropped matching network events.', severity: 'high', stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'network' }] }), reply() as any)
    state.rows[0].severity = 'critical'
    expect((await getRule(request(created.rule.id), reply() as any)).rule.severity).toBe('critical')
    state.rows[0].definition.action = 'keep'
    expect((await getRule(request(created.rule.id), reply() as any)).rule.severity).toBe('critical')
})

test('owned Store scope is validated, saved and audited', async () => {
    state.systemAdmin = true
    const conditions = [{ path: 'event_type', operator: 'equals', value: 'authentication' }]
    const created = await postRule(request('', { ...edit, stage: 'analyze', action: 'keep', conditions }), reply() as any)
    const changed = await putRule(request(created.rule.id, { ...edit, conditions, action: 'keep', storeScope: 'custom_drop' }), reply() as any)
    expect(changed.rule.definition.storeScope).toBe('custom_drop')
    expect(state.audits.at(-1).context.after.definition.storeScope).toBe('custom_drop')
    const invalid = reply()
    await putRule(request(created.rule.id, { ...edit, version: changed.rule.version, conditions, storeScope: 'hidden' }), invalid as any)
    expect(invalid.statusCode).toBe(400)
})
