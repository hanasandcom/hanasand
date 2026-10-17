import { expect, test } from 'bun:test'
import { state, reply, request, edit, defaultRuleDefinition, normalizeBuiltinDefinition, putRule, postRuleAction } from './support/rule-editing-fixture.ts'

test.each(['postgresql.readiness_audit.v1', 'model.verified_discovery_probes.v1'])('unverified %s cannot be enabled or configured to drop', async id => {
    state.systemAdmin = true
    const definition = { match: 'all', stage: 'analyze', action: 'keep', conditions: [], parameters: {} }
    state.rows.push({ id: 'unavailable-rule', organization_id: 'org-a', rule_id: id, version: '1', name: 'Unverified probe', explanation: 'Await independent verification before enabling.', source: 'hanasand', severity: 'low', enabled: false, definition })
    const enabled = reply()
    await postRuleAction(request(id, { action: 'enable' }), enabled as any)
    expect(enabled.statusCode).toBe(409)
    const edited = reply()
    await putRule(request(id, { ...edit, enabled: true, definition }), edited as any)
    expect(edited.statusCode).toBe(409)
    expect(normalizeBuiltinDefinition(id, { ...definition, action: 'drop' }).error).toBeTruthy()
    const dropEdit = reply()
    await putRule(request(id, { ...edit, enabled: false, definition: { ...definition, action: 'drop' } }), dropEdit as any)
    expect(dropEdit.statusCode).toBe(400)
    expect(state.rows[0].enabled).toBe(false)
    expect(state.rows[0].definition.action).toBe('keep')
    expect(state.audits).toEqual([])
})

test.each(['postgresql.readiness_audit.v1', 'model.verified_discovery_probes.v1'])('configured %s can be enabled with saved policy and an audit revision', async id => {
    const key = id.startsWith('model.') ? 'MODEL_PROBE_PROOF_KEY' : 'READINESS_AUDIT_PROOF_PUBLIC_KEY'
    const previous = process.env[key]
    process.env[key] = '1'.repeat(64)
    try {
        state.systemAdmin = true
        const definition = defaultRuleDefinition(id)
        state.rows.push({ id: 'verified-rule', organization_id: 'org-a', rule_id: id, version: '1', name: 'Verified probe', explanation: 'Verified native probe identity and successful completion.', source: 'hanasand', severity: 'low', enabled: false, definition })
        expect(normalizeBuiltinDefinition(id, definition).error).toBeUndefined()
        const response = reply()
        await postRuleAction(request(id, { action: 'enable' }), response as any)
        expect(response.statusCode).toBe(200)
        expect(state.rows[0]).toMatchObject({ enabled: true, version: '2' })
        expect(state.audits[0].context).toMatchObject({ before: { enabled: false }, after: { enabled: true, version: '2' } })
        expect(normalizeBuiltinDefinition(id, { ...definition, conditions: [{ path: 'service', operator: 'equals', value: 'anything', caseSensitive: true }] }).definition?.conditions).toEqual([{ path: 'service', operator: 'equals', value: 'anything', caseSensitive: true }])
        expect(normalizeBuiltinDefinition(id, { ...definition, parameters: { skipProof: 1 } }).error).toBeTruthy()
    } finally {
        if (previous === undefined) delete process.env[key]
        else process.env[key] = previous
    }
})
