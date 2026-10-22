import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import type { AutomationRow } from '../src/utils/automations.ts'

let failSave = 0, saveCount = 0, denied = false, probeFails = false, slow = false, clockOffset = 0, probeCount = 0, pushMode = false, pausedRunNow = false
const statements: string[] = [], scheduledValues: Array<{ sql: string, values: unknown[] }> = [], outcomes: Array<{ kind: unknown, message: string }> = []
const persistenceError = new Error('timeout exceeded when trying to connect')
const actualNow = Date.now
const query = async (sql: string, values: unknown[] = []) => {
    statements.push(sql)
    scheduledValues.push({ sql, values })
    if (pausedRunNow && sql.includes('FROM agent_automations')) return { rows: [{ ...automation, status: 'paused' }] }
    if (pushMode && sql.includes('SELECT * FROM agent_automations WHERE id=$1 FOR UPDATE')) {
        return { rows: [{ ...automation, monitoring_type: 'push', status: 'active' }] }
    }
    if (sql.includes('SET status = \'completed\'') || sql.includes('last_status = CASE WHEN $8')) {
        if (++saveCount === failSave) throw persistenceError
    }
    return { rows: [] }
}
mock.module('../src/utils/db.ts', () => ({ default: query, queryOnce: query, withTransaction: async (work: (q: typeof query) => unknown) => work(query) }))
mock.module('../src/utils/automationAccess.ts', () => ({
    checkScheduledAutomationAccess: async () => { if (denied) throw new Error('Access denied.') },
    automationAccessError: async () => null,
    automationReadScope: () => 'TRUE',
    automationWriteScope: () => 'TRUE',
}))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: { headers: Record<string, string> }) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: false }) }))
mock.module('../src/utils/monitoringIssues.ts', () => ({
    recordMonitoringOutcome: async (_automation: unknown, _run: string, kind: unknown, message: string) => { outcomes.push({ kind, message }) },
    notifyMonitoringOutcome: async () => {},
    loadMonitoringIssues: async () => [],
    monitoringIssueFingerprint: (automation: { monitoring_type: string, target_url: string | null }, kind: string) => `${automation.monitoring_type}:${automation.target_url}:${kind}`,
}))
mock.module('../src/utils/publicMonitoringRequest.ts', () => ({
    monitoringUrl: (url: URL) => url,
    monitoringLookup: () => () => {}, resolveMonitoringAddresses: async () => [],
    publicMonitoringRequest: async () => {
        probeCount++
        if (slow) clockOffset += 1500
        return { status: probeFails ? 503 : 200, body: '' }
    },
}))
const { executeAutomation } = await import('../src/utils/automations.ts')
const { postAutomationRunNow } = await import('../src/handlers/automations.ts')
const automation = { id: 'persistence-test', owner_id: 'owner', name: 'Backup check', action_type: 'agent_prompt',
    target_url: 'http://example.test/health', monitoring_type: 'fetch', timeout_seconds: 5, retry_count: 0,
    schedule_kind: 'interval', interval_minutes: 1, organization_id: 'organization', notification_destinations: [],
} as AutomationRow
beforeEach(() => {
    failSave = 0; saveCount = 0; denied = false; probeFails = false; slow = false; clockOffset = 0; probeCount = 0; pushMode = false; pausedRunNow = false
    statements.length = 0; scheduledValues.length = 0; outcomes.length = 0
    Date.now = () => actualNow() + clockOffset
})
afterEach(() => { Date.now = actualNow })

for (const save of [1, 2]) for (const warning of [false, true]) {
    test(`save ${save} failure after ${warning ? 'clock-advancing' : 'normal'} healthy probe does not create a failure case`, async () => {
        failSave = save; slow = warning
        await expect(executeAutomation(automation)).rejects.toBe(persistenceError)
        expect(probeCount).toBe(1)
        expect(outcomes).toEqual([])
        expect(statements.some(sql => sql.includes('SET status = \'failed\''))).toBe(false)
    })
}
test('a real probe failure retains its result and failure scheduling', async () => {
    probeFails = true
    await executeAutomation(automation)
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]?.kind).toBe('failure')
    expect(outcomes[0]?.message).toContain('HTTP 503')
    expect(statements.some(sql => sql.includes('consecutive_failures = consecutive_failures + 1'))).toBe(true)
})
test('expected-down HTTP checks treat an unavailable target as healthy', async () => {
    probeFails = true
    await executeAutomation({ ...automation, expected_down: true })
    expect(probeCount).toBe(1)
    expect(outcomes[0]?.kind).toBeNull()
    expect(outcomes[0]?.message).toBe('Backup check passed its FETCH health check (HTTP 503).')
})
test('access denial does not run the probe or create a monitoring case', async () => {
    denied = true
    await executeAutomation(automation)
    expect(probeCount).toBe(0)
    expect(outcomes).toEqual([])
})
test('push monitoring access errors finish as failed runs without creating a sensor issue', async () => {
    pushMode = true
    denied = true
    await expect(executeAutomation({ ...automation, monitoring_type: 'push' })).resolves.toBeUndefined()
    expect(statements.some(sql => sql.includes('\'external-monitor\',\'push\''))).toBe(true)
    expect(statements.some(sql => sql.includes('last_status=\'failed\''))).toBe(true)
    expect(outcomes).toEqual([])
})
test('a paused check cannot be claimed for a manual run', async () => {
    pausedRunNow = true
    const response: { statusCode: number, body?: unknown } = { statusCode: 200 }
    const reply = {
        status(code: number) { response.statusCode = code; return this },
        send(body: unknown) { response.body = body; return body },
    }
    await postAutomationRunNow({ headers: { id: 'owner' }, params: { id: automation.id } } as never, reply as never)
    expect(response.statusCode).toBe(409)
    expect(statements).toHaveLength(1)
    expect(statements[0]?.includes('FROM agent_automations')).toBe(true)
    expect(response.body).toEqual({ error: 'Resume this check before running it.' })
})
test('successful persistence records recovery and resets failure scheduling', async () => {
    await executeAutomation(automation)
    expect(outcomes[0]?.kind).toBeNull()
    expect(saveCount).toBe(2)
    expect(statements.some(sql => sql.includes('consecutive_failures = 0'))).toBe(true)
})
test('success and failure schedule interval runs on the next minute tick', async () => {
    const successStartedAt = new Date().getTime()
    await executeAutomation({ ...automation, action_type: 'echo' })
    const successFinishedAt = new Date().getTime()
    const failureStartedAt = new Date().getTime()
    probeFails = true
    await executeAutomation({ ...automation, id: 'failed-interval' })
    const failureFinishedAt = new Date().getTime()

    const scheduledRuns = scheduledValues.filter(({ sql }) => sql.includes('UPDATE agent_automations'))
    expect(scheduledRuns).toHaveLength(2)
    for (const [{ values }, startedAt, finishedAt] of [
        [scheduledRuns[0], successStartedAt, successFinishedAt],
        [scheduledRuns[1], failureStartedAt, failureFinishedAt],
    ] as const) {
        expect(values[1]).toBeInstanceOf(Date)
        const nextRunAt = (values[1] as Date).getTime()
        expect(nextRunAt % 60_000).toBe(0)
        expect(nextRunAt).toBeGreaterThanOrEqual(Math.floor(startedAt / 60_000) * 60_000 + 60_000)
        expect(nextRunAt).toBeLessThanOrEqual(Math.floor(finishedAt / 60_000) * 60_000 + 60_000)
    }
})
test('success and failure clear next run time for one-off automations', async () => {
    await executeAutomation({ ...automation, id: 'once-success', schedule_kind: 'once', action_type: 'echo' })
    probeFails = true
    await executeAutomation({ ...automation, id: 'once-failure', schedule_kind: 'once' })

    const scheduledRuns = scheduledValues.filter(({ sql }) => sql.includes('UPDATE agent_automations'))
    expect(scheduledRuns).toHaveLength(2)
    expect(scheduledRuns.map(({ values }) => values[1])).toEqual([null, null])
})
test('non-monitoring actions retain their existing save-failure handling', async () => {
    failSave = 1
    await executeAutomation({ ...automation, action_type: 'echo' })
    expect(probeCount).toBe(0)
    expect(outcomes).toEqual([])
    expect(statements.some(sql => sql.includes('SET status = \'failed\''))).toBe(true)
})
