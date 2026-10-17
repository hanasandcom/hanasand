import { expect, test } from 'bun:test'
import { state, builtin, reply, request, edit, network, getRule, putRule, postRuleAction, ingestEvent } from './support/rule-editing-fixture.ts'

const bruteId = 'auth.brute_force_success'
const bruteDefinition = (windowMinutes = 15, minimumCount = 3) => ({ match: 'all', parameters: { windowMinutes, minimumCount }, conditions: [{ path: 'EventID', operator: 'equals', value: '4624' }], failureConditions: [{ path: 'EventID', operator: 'regex', value: '^(4625|4771)$' }] })
const login = (minutes: number, outcome: string, EventID: number, extra = {}) => ({ timestamp: new Date(Date.UTC(2026, 8, 14, 12, minutes)).toISOString(), event_type: 'authentication', action: 'login', outcome, EventID, user: { id: 'alice' }, ...extra })
const ingest = (items: any[]) => ingestEvent(request('', { events: items }), reply() as any)
const bruteFindings = () => state.findings.filter(item => item.ruleId === `${bruteId}.v1`)

test('stable links return latest; historical links return immutable, read-only signatures', async () => {
    await putRule(request(bruteId, { ...edit, definition: bruteDefinition(20, 4) }), reply() as any)
    expect((await getRule(request(bruteId), reply() as any)).rule.definition.parameters).toEqual({ windowMinutes: 20, minimumCount: 4 })
    const old = await getRule(request(`${bruteId}.v1`), reply() as any)
    expect(old).toMatchObject({ canEdit: false, isHistorical: true, currentVersion: '2', rule: { version: '1', definition: { parameters: { windowMinutes: 15, minimumCount: 3 } } } })
    const latest = await getRule(request(`${bruteId}.v2`), reply() as any)
    expect(latest).toMatchObject({ canEdit: true, isHistorical: false })
    const missing = reply()
    await getRule(request(`${bruteId}.v99`), missing as any)
    expect(missing.statusCode).toBe(404)
})

test('saved window, threshold and both event-ID selectors control actual ingestion, including out-of-order batches', async () => {
    await putRule(request(bruteId, { ...edit, definition: bruteDefinition(5, 2) }), reply() as any)
    await ingest([login(10, 'success', 4624), login(5, 'failure', 4625), login(6, 'failure', 4771)])
    expect(bruteFindings()).toHaveLength(1)
    expect(bruteFindings()[0].evidence).toMatchObject({ windowMinutes: 5, minimumCount: 2, ruleVersion: '2' })
    state.findings = []
    await ingest([login(10, 'success', 9999), login(12, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(0)
    await putRule(request(bruteId, { ...edit, version: '2', definition: bruteDefinition(10, 2) }), reply() as any)
    await ingest([login(12, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(1)
    await putRule(request(bruteId, { ...edit, version: '3', definition: bruteDefinition(10, 3) }), reply() as any)
    state.findings = []
    await ingest([login(12, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(0)
})

test('correlation excludes other users, tenants, future events, wrong actions and wrong event IDs', async () => {
    await putRule(request(bruteId, { ...edit, definition: bruteDefinition(5, 2) }), reply() as any)
    await ingest([login(6, 'failure', 4625), login(7, 'failure', 1), login(8, 'failure', 4625, { user: { id: 'bob' } }), login(8, 'failure', 4625, { action: 'logout' }), login(11, 'failure', 4625)])
    state.events.push({ ...state.events[0], id: 'other-org', organization_id: 'org-b' })
    await ingest([login(10, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(0)
})

test('more than 30 intervening events cannot hide in-window failures', async () => {
    await putRule(request(bruteId, { ...edit, definition: bruteDefinition(15, 3) }), reply() as any)
    await ingest([login(1, 'failure', 4625), login(2, 'failure', 4625), login(3, 'failure', 4771), ...Array.from({ length: 35 }, () => login(4, 'unknown', 0)), login(10, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(1)
})

test('invalid parameters and expressions never overwrite a saved detection', async () => {
    for (const definition of [bruteDefinition(0), bruteDefinition(10081), bruteDefinition(1.5), bruteDefinition(5, 0), { ...bruteDefinition(), parameters: { windowMinutes: '5', minimumCount: 2 } }, { ...bruteDefinition(), failureConditions: [{ path: 'EventID', operator: 'regex', value: '[' }] }, { ...bruteDefinition(), script: 'arbitrary' }]) {
        const response = reply()
        await putRule(request(bruteId, { ...edit, definition }), response as any)
        expect(response.statusCode).toBe(400)
    }
    expect(state.rows).toHaveLength(0)
    expect(state.audits).toHaveLength(0)
})

test('password spray honors the saved distinct-user threshold, window and event selector', async () => {
    const id = 'auth.password_spray'
    const definition = { match: 'all', parameters: { windowMinutes: 2, minimumCount: 2 }, conditions: [{ path: 'EventID', operator: 'equals', value: '4625' }] }
    await putRule(request(id, { ...edit, definition }), reply() as any)
    await ingest([login(1, 'failure', 4625, { source: { ip: '192.0.2.1' } }), login(2, 'failure', 4625, { source: { ip: '192.0.2.1' }, user: { id: 'bob' } })])
    expect(state.findings.filter(row => row.ruleId === `${id}.v1`)).toHaveLength(1)
    state.findings = []
    await ingest([login(5, 'failure', 4625, { source: { ip: '192.0.2.1' }, user: { id: 'charlie' } })])
    expect(state.findings.filter(row => row.ruleId === `${id}.v1`)).toHaveLength(0)
})

test('built-in network event selector gates findings and survives enable/disable', async () => {
    await putRule(request(builtin, { ...edit, definition: { match: 'all', conditions: [{ path: 'signature', operator: 'equals', value: 'Other' }], parameters: {} } }), reply() as any)
    await ingestEvent(request('', network), reply() as any)
    expect(state.findings).toHaveLength(0)
    await postRuleAction(request(builtin, { action: 'disable' }), reply() as any)
    await postRuleAction(request(builtin, { action: 'enable' }), reply() as any)
    expect((await getRule(request(), reply() as any)).rule.definition.conditions[0].value).toBe('Other')
    await ingestEvent(request('', network), reply() as any)
    expect(state.findings).toHaveLength(0)
})
