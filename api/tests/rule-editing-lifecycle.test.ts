import { expect, test } from 'bun:test'
import { state, builtin, reply, request, edit, network, getRule, putRule, postRuleAction, postRule, postRulePack, postEventSigmaPack, ingestEvent } from './support/rule-editing-fixture.ts'

test.each(['http.routine_access.v1', 'mongodb.cashflow_connections.v1'])('only system administrators can change %s retention; changes are versioned and audited', async (id) => {
    const definition = { match: 'all', stage: 'analyze', action: 'drop', conditions: [], parameters: id.startsWith('http.') ? { windowMinutes: 1, requestThreshold: 50 } : {} }
    state.rows = [{ id: 'platform-rule', organization_id: 'org-a', rule_id: id, version: '1', name: 'Routine successful requests', family: 'HTTP', severity: 'high', explanation: 'Count and drop routine successful HTTP requests.', source: 'hanasand', enabled: true, definition }]
    expect((await getRule(request(id), reply() as any)).canEdit).toBe(false)
    const denied = reply()
    await postRuleAction(request(id, { action: 'disable' }), denied as any)
    expect(denied.statusCode).toBe(403)
    state.systemAdmin = true
    const body = { ...edit, severity: 'high', definition: { ...definition, action: 'keep' } }
    const saved = await putRule(request(id, body), reply() as any)
    expect(saved.rule.definition.action).toBe('keep')
    expect(saved.rule.version).toBe('2')
    expect(state.audits[0].context.before.definition.action).toBe('drop')
    expect(state.audits[0].context.after.definition.action).toBe('keep')
    const invalid = reply()
    await putRule(request(id, { ...body, version: '2', definition: { ...definition, stage: 'detection' } }), invalid as any)
    expect(invalid.statusCode).toBe(400)
})

test('custom Analyze rules use the same platform-retention edit boundary', async () => {
    const id = 'custom.analyze.v1'
    state.rows = [{
        id: 'custom-analyze', organization_id: 'org-a', rule_id: id, version: '1',
        name: 'Count failed deliveries', family: 'Custom', severity: 'high', explanation: 'Count failed delivery events for operator review.',
        source: 'owned', enabled: true,
        definition: { match: 'all', conditions: [], stage: 'analyze', action: 'drop', parameters: {} },
    }]

    expect((await getRule(request(id), reply() as any)).canEdit).toBe(false)
    const actionResponse = reply()
    await postRuleAction(request(id, { action: 'disable' }), actionResponse as any)
    expect(actionResponse.statusCode).toBe(403)
    const updateResponse = reply()
    await putRule(request(id, { ...edit, version: '1', conditions: [], action: 'drop' }), updateResponse as any)
    expect(updateResponse.statusCode).toBe(403)
})

test('built-in detail ID survives editing, and new detections use saved severity and revision', async () => {
    const initial = await getRule(request(), reply() as any)
    expect(initial.rule.id).toBe(builtin)
    expect(initial.rule.version).toBe('1')
    await putRule(request(builtin, edit), reply() as any)
    const saved = await getRule(request(), reply() as any)
    expect(saved.rule).toMatchObject({ id: builtin, name: edit.name, severity: 'critical', version: '2' })
    expect(saved.audit[0].context.before.severity).toBe('high')
    expect(saved.audit[0].context.after.severity).toBe('critical')
    expect(saved.audit[0].actor_id).toBe('editor')
    await ingestEvent(request(builtin, network), reply() as any)
    expect(state.findings[0]).toMatchObject({ ruleId: builtin, severity: 'critical', evidence: { ruleVersion: '2', ruleName: edit.name } })
    await postRuleAction(request(builtin, { action: 'disable' }), reply() as any)
    state.findings = []
    await ingestEvent(request(builtin, network), reply() as any)
    expect(state.findings).toHaveLength(0)
    expect((await getRule(request(), reply() as any)).rule.name).toBe(edit.name)
})

test('rejects stale edits and never commits a rule without its audit event', async () => {
    await putRule(request(builtin, edit), reply() as any)
    const stale = reply()
    await putRule(request(builtin, { ...edit, name: 'Lost update' }), stale as any)
    expect(stale.statusCode).toBe(409)
    expect(state.rows[0].name).toBe(edit.name)
    state.auditFailure = true
    await expect(putRule(request(builtin, { ...edit, version: '2', name: 'Must roll back' }), reply() as any)).rejects.toThrow('Audit unavailable')
    expect(state.rows[0].name).toBe(edit.name)
    expect(state.audits).toHaveLength(1)
})

test('rejects UI and API rule changes while stored-log processing is active', async () => {
    state.systemAdmin = true
    state.rows = [{ id: 'custom-rule', organization_id: 'org-a', rule_id: 'custom.log_drop.v1', version: '1', name: 'Drop old logs', family: 'Custom', severity: 'low', explanation: 'Drop routine stored log records.', source: 'owned', enabled: true, definition: { match: 'all', stage: 'analyze', action: 'drop', conditions: [{ path: 'message', operator: 'equals', value: 'noise' }] } }]
    state.activeReprocessRules.add('org-a:custom.log_drop.v1')

    const disabled = reply()
    await postRuleAction(request('custom.log_drop.v1', { action: 'disable' }), disabled as any)
    expect(disabled.statusCode).toBe(409)
    expect(state.rows[0].enabled).toBe(true)

    const edited = reply()
    await putRule(request('custom.log_drop.v1', { ...edit, version: '1', conditions: [{ path: 'message', operator: 'equals', value: 'other' }], action: 'drop' }), edited as any)
    expect(edited.statusCode).toBe(409)
    expect(state.rows[0].version).toBe('1')
    expect(state.rows[0].definition.conditions[0].value).toBe('noise')
})

test('membership is required for detail/history, and only owner/admin may edit', async () => {
    for (const handler of [getRule, putRule]) {
        const forbidden = reply()
        await handler(request(builtin, edit, 'other-org'), forbidden as any)
        expect(forbidden.statusCode).toBe(403)
    }
    state.role = 'member'
    expect((await getRule(request(), reply() as any)).canEdit).toBe(false)
    const forbidden = reply()
    await putRule(request(builtin, edit), forbidden as any)
    expect(forbidden.statusCode).toBe(403)
    state.valid = false
    const anonymous = reply()
    await getRule(request(), anonymous as any)
    expect(anonymous.statusCode).toBe(401)
    expect(state.audits).toHaveLength(0)
})

test('custom condition edits affect matching; invalid definitions are rejected', async () => {
    const created = await postRule(request('', { ...edit, conditions: [{ path: 'signature', operator: 'equals', value: 'Other' }] }), reply() as any)
    const id = created.rule.id
    await ingestEvent(request('', network), reply() as any)
    expect(state.findings.some(row => row.ruleId === id)).toBe(false)
    await putRule(request(id, { ...edit, conditions: [{ path: 'signature', operator: 'equals', value: 'Test signature' }] }), reply() as any)
    await ingestEvent(request('', network), reply() as any)
    expect(state.findings.some(row => row.ruleId === id && row.evidence.ruleVersion === '2')).toBe(true)
    const invalid = reply()
    await putRule(request(id, { ...edit, version: '2', conditions: [{ path: 'signature', operator: 'regex', value: '[' }] }), invalid as any)
    expect(invalid.statusCode).toBe(400)
    const replacement = reply()
    await putRule(request(builtin, { ...edit, conditions: [] }), replacement as any)
    expect(replacement.statusCode).toBe(400)
})

test('reimport retains ID and disabled state and adds a per-rule audit revision', async () => {
    const pack = { packName: 'Test pack', packVersion: '1', sourceReference: 'https://example.com/rules', rules: [{ id: 'network', ...edit, conditions: [{ path: 'signature', operator: 'equals', value: 'Test' }] }] }
    await postRulePack(request('', pack), reply() as any)
    const id = state.rows[0].rule_id, recordId = state.rows[0].id
    await postRuleAction(request(recordId, { action: 'disable' }), reply() as any)
    await postRulePack(request('', pack), reply() as any)
    expect(state.rows[0]).toMatchObject({ id: recordId, rule_id: id, enabled: false, version: '3' })
    const detail = await getRule(request(id.replace(/\.v\d+$/, '')), reply() as any)
    expect(detail.audit).toHaveLength(3)
    expect(detail.audit.every((entry: any) => entry.context.ruleId === id)).toBe(true)
})

test('rule pack formats share metadata validation and retain format-specific source errors', async () => {
    const importers = [
        { import: postRulePack, body: { packName: 'Test pack', packVersion: '1', sourceReference: 'http://example.com/rules', rules: [] }, sourceError: 'Open-source pack reference must be an HTTPS URL of at most 300 characters.' },
        { import: postEventSigmaPack, body: { packName: 'Test pack', packVersion: '1', sourceReference: 'http://example.com/rules', yaml: '' }, sourceError: 'Sigma source reference must be an HTTPS URL of at most 300 characters.' },
    ]
    for (const importer of importers) {
        const invalidMetadata = reply()
        const metadataError = await importer.import(request('', { ...importer.body, packName: 'x' }), invalidMetadata as any)
        expect(invalidMetadata.statusCode).toBe(400)
        expect(metadataError).toEqual({ error: 'Pack name must contain 2-100 characters and version 1-40 characters.' })

        const invalidSource = reply()
        const sourceError = await importer.import(request('', importer.body), invalidSource as any)
        expect(invalidSource.statusCode).toBe(400)
        expect(sourceError).toEqual({ error: importer.sourceError })
    }
})

test('unchanged saves do not clutter history, and older audit pages remain accessible', async () => {
    await putRule(request(builtin, edit), reply() as any)
    await putRule(request(builtin, { ...edit, version: '2' }), reply() as any)
    expect(state.audits).toHaveLength(1)
    expect(state.rows[0].version).toBe('2')
    for (let index = 1; index < 52; index++) state.audits.push({ ...state.audits[0], id: String(index) })
    const first = await getRule(request(), reply() as any)
    expect(first.audit).toHaveLength(50)
    expect(first.nextOffset).toBe(50)
    const secondRequest = request()
    secondRequest.query.offset = '50'
    const second = await getRule(secondRequest, reply() as any)
    expect(second.audit).toHaveLength(2)
    expect(second.nextOffset).toBeNull()
})
