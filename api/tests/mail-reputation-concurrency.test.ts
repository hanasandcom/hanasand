import { afterEach, expect, mock, test } from 'bun:test'

type CachedVerdict = { status: 'known' | 'unknown', flagged: number | null, total: number | null, report_url: string, checked_at: Date, expires_at: Date }
const cache = new Map<string, CachedVerdict>()
const lockTails = new Map<string, Promise<void>>()
const originalFetch = globalThis.fetch

async function query(sql: string, values: unknown[] = []) {
    const key = `${String(values[0])}:${String(values[1])}`
    if (sql.startsWith('SELECT status, flagged, total')) {
        const row = cache.get(key)
        return { rows: row && row.expires_at > new Date() ? [row] : [] }
    }
    if (sql.startsWith('INSERT INTO mail_reputation_cache')) {
        cache.set(key, {
            status: String(values[2]) as 'known' | 'unknown',
            flagged: values[3] === null ? null : Number(values[3]),
            total: values[4] === null ? null : Number(values[4]),
            report_url: String(values[5]),
            checked_at: values[6] as Date,
            expires_at: values[7] as Date,
        })
        return { rows: [] }
    }
    throw new Error(`Unexpected query in mail reputation test: ${sql}`)
}

async function withLock<T>(key: string, work: (query: typeof query) => Promise<T>) {
    const previous = lockTails.get(key) || Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => { release = resolve })
    lockTails.set(key, previous.then(() => current))
    await previous
    try { return await work(query) }
    finally { release() }
}

mock.module('#db', () => ({ default: query, withDatabaseAdvisoryLock: withLock }))
const { lookupUrlReputation } = await import('../src/utils/mail/urlReputation.ts')

afterEach(() => {
    cache.clear()
    lockTails.clear()
    mock.restore()
    globalThis.fetch = originalFetch
    delete process.env.VIRUSTOTAL_API_KEY
})

test('parallel clients reuse one VirusTotal lookup for the same URL cache miss', async () => {
    process.env.VIRUSTOTAL_API_KEY = 'test-key'
    let requests = 0
    globalThis.fetch = async (input) => {
        requests += 1
        const requestedId = new URL(String(input)).pathname.split('/').at(-1)
        await new Promise(resolve => setTimeout(resolve, 10))
        return Response.json({ data: { type: 'url', id: requestedId, attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 90 } } } })
    }

    const url = { id: 'a'.repeat(64), url: 'https://images.example.test/pixel.png' }
    const verdicts = await Promise.all(Array.from({ length: 8 }, () => lookupUrlReputation(url)))

    expect(requests).toBe(1)
    expect(verdicts.every(verdict => verdict.status === 'known' && verdict.flagged === 0)).toBe(true)
})
