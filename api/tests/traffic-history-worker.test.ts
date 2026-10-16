import { afterAll, afterEach, expect, mock, spyOn, test } from 'bun:test'

const originalHttpOnly = process.env.API_HTTP_ONLY
const statements: string[] = []
const parameters: unknown[][] = []
let readOnly = false
const execute = async (sql: string, params: unknown[] = []) => {
    statements.push(sql)
    parameters.push(params)
    return { rows: sql.includes('pg_try_advisory_xact_lock') ? [{ acquired: true }] : [{ pending: false }] }
}
mock.module('#db', () => ({ queryOnce: execute, withTransaction: async (work: (query: typeof execute) => Promise<unknown>) => work(execute) }))
mock.module('../src/utils/recovery.ts', () => ({ recoveryReadOnly: () => readOnly }))
const { cacheTrafficHistoryHour, refreshTrafficHistory } = await import('../src/utils/traffic/history.ts')
let stop: (() => void) | undefined
const intervals = spyOn(globalThis, 'setInterval')
afterAll(() => intervals.mockRestore())
afterEach(() => {
    stop?.()
    stop = undefined
    statements.length = 0
    parameters.length = 0
    readOnly = false
    intervals.mockClear()
    if (originalHttpOnly === undefined) delete process.env.API_HTTP_ONLY
    else process.env.API_HTTP_ONLY = originalHttpOnly
})

test('history refresh bounds invalid and oversized batch requests', async () => {
    await cacheTrafficHistoryHour(Number.NaN)
    expect(parameters[1]).toEqual([1])

    statements.length = 0
    parameters.length = 0
    await cacheTrafficHistoryHour(100)
    expect(parameters[1]).toEqual([24])
})

test('HTTP-only API starts no traffic history writes or background timer', async () => {
    process.env.API_HTTP_ONLY = '1'
    stop = refreshTrafficHistory()
    await Bun.sleep(0)
    expect(statements).toEqual([])
    expect(intervals).not.toHaveBeenCalled()
})

test('normal background worker still refreshes history and installs its timer', async () => {
    delete process.env.API_HTTP_ONLY
    stop = refreshTrafficHistory()
    await Bun.sleep(0)
    expect(statements).toHaveLength(2)
    expect(statements[1]).toContain('FOR UPDATE')
    expect(intervals).toHaveBeenCalledTimes(1)
})

test('read-only recovery still suppresses history writes on a background worker', async () => {
    delete process.env.API_HTTP_ONLY
    readOnly = true
    stop = refreshTrafficHistory()
    await Bun.sleep(0)
    expect(statements).toEqual([])
    expect(intervals).toHaveBeenCalledTimes(1)
})
