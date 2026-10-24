import { afterAll, beforeEach, expect, mock, spyOn, test } from 'bun:test'

const previous = {
    enabled: process.env.LOGS_OUTBOX_ENABLED,
    url: process.env.LOGS_SERVICE_URL,
    ingest: process.env.LOGS_SERVICE_INGEST_TOKEN,
    sync: process.env.LOGS_SERVICE_SYNC_TOKEN,
    remoteOnly: process.env.LOGS_OUTBOX_REMOTE_ONLY,
    direct: process.env.LOGS_SERVICE_DIRECT,
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

const { deliverLogsOutboxBatch, startLogsServiceBackgroundTasks } = await import('../src/utils/logs/logOutbox.ts')

beforeEach(() => {
    statements.length = 0
    organizations = []
    events = []
    process.env.LOGS_OUTBOX_ENABLED = '1'
    process.env.LOGS_SERVICE_URL = 'https://logs.hanasand.com'
    process.env.LOGS_SERVICE_INGEST_TOKEN = 'i'.repeat(40)
    process.env.LOGS_SERVICE_SYNC_TOKEN = 's'.repeat(40)
    delete process.env.LOGS_OUTBOX_REMOTE_ONLY
    delete process.env.LOGS_SERVICE_DIRECT
})

afterAll(() => {
    globalThis.fetch = originalFetch
    for (const [key, value] of Object.entries({
        LOGS_OUTBOX_ENABLED: previous.enabled,
        LOGS_SERVICE_URL: previous.url,
        LOGS_SERVICE_INGEST_TOKEN: previous.ingest,
        LOGS_SERVICE_SYNC_TOKEN: previous.sync,
        LOGS_OUTBOX_REMOTE_ONLY: previous.remoteOnly,
        LOGS_SERVICE_DIRECT: previous.direct,
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

test('partial Logs acknowledgements delete only hash-proven rows and defer conflicts', async () => {
    const accepted = { sourceEventId: 'event-accepted', message: 'stored', metadata: { z: 2, a: 1 } }
    const conflict = { sourceEventId: 'event-conflict', message: 'conflict' }
    events = [
        { id: 17, payload: accepted, attempts: 1 },
        { id: 18, payload: conflict, attempts: 2 },
    ]
    globalThis.fetch = async (_input, init) => {
        expect((init?.headers as Record<string, string>)['x-logs-partial-ack']).toBe('collector-v1')
        return new Response(JSON.stringify({ ok: true, accepted: 1, deferred: 1,
            deferredQueueEventIds: ['event-conflict'],
            resolvedQueueEvents: [{ sourceEventId: 'event-accepted', payloadSha256: '2efedc731a607735bccecdcfda4bdb6e560f9de274db8b7826e2a39b163ba446', disposition: 'stored' }] }),
        { status: 202 })
    }

    expect(await deliverLogsOutboxBatch()).toBe(true)
    expect(statements.find(item => item.sql.startsWith('DELETE FROM log_delivery_outbox'))?.params).toEqual([['17']])
    const deferred = statements.find(item => item.sql.includes('UPDATE log_delivery_outbox SET lease_until=NULL'))
    expect(deferred?.params).toEqual([['18'], 4, 'HTTP 409: conflicting event identities were deferred by Logs'])
})

test('partial Logs acknowledgement with a mismatched payload hash keeps every row', async () => {
    events = [{ id: 19, payload: { sourceEventId: 'event-19', message: 'stored' }, attempts: 1 }]
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, accepted: 1, deferred: 0,
        deferredQueueEventIds: [],
        resolvedQueueEvents: [{ sourceEventId: 'event-19', payloadSha256: 'a'.repeat(64), disposition: 'stored' }] }),
    { status: 202 })

    await expect(deliverLogsOutboxBatch()).rejects.toThrow('incomplete partial acknowledgement')
    expect(statements.some(item => item.sql.startsWith('DELETE FROM log_delivery_outbox'))).toBe(false)
    expect(statements.find(item => item.sql.includes('UPDATE log_delivery_outbox SET lease_until=NULL'))?.params[0]).toEqual(['19'])
})

test('conflict-only Logs response defers the entire outbox batch without deleting rows', async () => {
    events = [
        { id: 20, payload: { sourceEventId: 'conflict-a' }, attempts: 3 },
        { id: 21, payload: { sourceEventId: 'conflict-b' }, attempts: 4 },
    ]
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'LOGS_EVENT_PAYLOAD_CONFLICT',
        conflictingSourceEventIds: ['conflict-a', 'conflict-b'], error: 'Every submitted source identity conflicts with stored data.' }),
    { status: 409 })

    await expect(deliverLogsOutboxBatch()).rejects.toThrow('HTTP 409')
    expect(statements.some(item => item.sql.startsWith('DELETE FROM log_delivery_outbox'))).toBe(false)
    expect(statements.find(item => item.sql.includes('UPDATE log_delivery_outbox SET lease_until=NULL'))?.params[0]).toEqual(['20', '21'])
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

    const stop = startLogsServiceBackgroundTasks(error => errors.push(error))
    stop()

    expect(intervals).toEqual([1000, 60_000])
    expect(clear).toHaveBeenCalledTimes(2)
    expect(errors).toEqual([])
    schedule.mockRestore()
    clear.mockRestore()
})

test('direct-only mode starts no Hanasand-backed background work', () => {
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_SERVICE_DIRECT = '1'
    const intervals: number[] = []
    const timer = { unref() {} }
    const schedule = spyOn(globalThis, 'setInterval').mockImplementation(((callback: TimerHandler, delay?: number) => {
        intervals.push(Number(delay))
        return timer as unknown as ReturnType<typeof setInterval>
    }) as typeof setInterval)
    const clear = spyOn(globalThis, 'clearInterval').mockImplementation(() => {})
    const errors: unknown[] = []

    const stop = startLogsServiceBackgroundTasks(error => errors.push(error))
    stop()

    expect(intervals).toEqual([])
    expect(clear).toHaveBeenCalledTimes(0)
    expect(errors).toEqual([])
    schedule.mockRestore()
    clear.mockRestore()
})

test('direct mode keeps draining the old outbox but disables the snapshot writer', () => {
    process.env.LOGS_OUTBOX_ENABLED = '1'
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_SERVICE_DIRECT = '1'
    const intervals: number[] = []
    const timer = { unref() {} }
    const schedule = spyOn(globalThis, 'setInterval').mockImplementation(((callback: TimerHandler, delay?: number) => {
        intervals.push(Number(delay))
        return timer as unknown as ReturnType<typeof setInterval>
    }) as typeof setInterval)
    const clear = spyOn(globalThis, 'clearInterval').mockImplementation(() => {})

    const stop = startLogsServiceBackgroundTasks(() => {})
    stop()

    expect(intervals).toEqual([1000])
    expect(clear).toHaveBeenCalledTimes(1)
    schedule.mockRestore()
    clear.mockRestore()
})
