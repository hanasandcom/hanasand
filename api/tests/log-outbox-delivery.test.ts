import { afterAll, beforeEach, expect, mock, spyOn, test } from 'bun:test'

const previous = {
    enabled: process.env.LOGS_OUTBOX_ENABLED,
    url: process.env.LOGS_SERVICE_URL,
    ingest: process.env.LOGS_SERVICE_INGEST_TOKEN,
    sync: process.env.LOGS_SERVICE_SYNC_TOKEN,
}
const originalFetch = globalThis.fetch
const statements: Array<{ sql: string; params: unknown[] }> = []
let organizations: Array<Record<string, unknown>> = []
let events: Array<Record<string, unknown>> = []
const query = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.includes('FROM log_organization_sync_outbox') && sql.includes('WITH selected AS')) return { rows: organizations }
    if (sql.includes('FROM log_delivery_outbox e') && sql.includes('WITH selected AS')) return { rows: events }
    return { rows: [] }
}

mock.module('#db', () => ({
    default: query,
    withTransaction: async (work: (query: typeof query) => unknown) => work(query),
}))

const { deliverLogsOutboxBatch, startLogsOutboxDelivery } = await import('../src/utils/logs/logOutbox.ts')

beforeEach(() => {
    statements.length = 0
    organizations = []
    events = []
    process.env.LOGS_OUTBOX_ENABLED = '1'
    process.env.LOGS_SERVICE_URL = 'https://logs.hanasand.com'
    process.env.LOGS_SERVICE_INGEST_TOKEN = 'i'.repeat(40)
    process.env.LOGS_SERVICE_SYNC_TOKEN = 's'.repeat(40)
})

afterAll(() => {
    globalThis.fetch = originalFetch
    for (const [key, value] of Object.entries({
        LOGS_OUTBOX_ENABLED: previous.enabled,
        LOGS_SERVICE_URL: previous.url,
        LOGS_SERVICE_INGEST_TOKEN: previous.ingest,
        LOGS_SERVICE_SYNC_TOKEN: previous.sync,
    })) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})

test('deletes the transfer row only after Logs acknowledges the committed event batch', async () => {
    events = [{ id: 7, payload: { sourceEventId: 'event-1' }, attempts: 1 }]
    let sentUrl = ''
    globalThis.fetch = async (input, init) => {
        sentUrl = String(input)
        expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${'i'.repeat(40)}`)
        return new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 201 })
    }

    expect(await deliverLogsOutboxBatch()).toBe(true)
    expect(sentUrl).toBe('https://logs.hanasand.com/api/ingest')
    expect(statements.some(item => item.sql.startsWith('DELETE FROM log_delivery_outbox'))).toBe(true)
})

test('keeps and defers queued events when the receiver redirects instead of acknowledging', async () => {
    events = [{ id: 8, payload: { sourceEventId: 'event-2' }, attempts: 3 }]
    globalThis.fetch = async () => new Response('Moved', { status: 301 })

    await expect(deliverLogsOutboxBatch()).rejects.toThrow('HTTP 301')
    expect(statements.some(item => item.sql.includes('UPDATE log_delivery_outbox SET lease_until=NULL'))).toBe(true)
    expect(statements.some(item => item.sql.startsWith('DELETE FROM log_delivery_outbox'))).toBe(false)
})

test('synchronizes a tenant snapshot before attempting that tenant event batch', async () => {
    organizations = [{ organization_id: 'tenant-1', source_updated_at: '2026-10-22T12:00:00.000Z',
        payload: { id: 'tenant-1', rules: [] }, attempts: 1 }]
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 200 })

    expect(await deliverLogsOutboxBatch()).toBe(true)
    expect(statements.some(item => item.sql.includes('UPDATE log_organization_sync_outbox o SET delivered_at=NOW()'))).toBe(true)
    expect(statements.some(item => item.sql.includes('FROM log_delivery_outbox e'))).toBe(true)
})

test('starts delivery and snapshot refresh loops and clears both timers on shutdown', async () => {
    const intervals: number[] = []
    const timer = { unref() {} }
    const schedule = spyOn(globalThis, 'setInterval').mockImplementation(((callback: TimerHandler, delay?: number) => {
        intervals.push(Number(delay))
        return timer as unknown as ReturnType<typeof setInterval>
    }) as typeof setInterval)
    const clear = spyOn(globalThis, 'clearInterval').mockImplementation(() => {})
    const errors: unknown[] = []

    const stop = startLogsOutboxDelivery(error => errors.push(error))
    stop()

    expect(intervals).toEqual([1000, 60_000])
    expect(clear).toHaveBeenCalledTimes(2)
    expect(errors).toEqual([])
    schedule.mockRestore()
    clear.mockRestore()
})
