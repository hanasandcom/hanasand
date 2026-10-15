import { describe, expect, test } from 'bun:test'
import { check, fetchJson } from '../src/utils/status/monitor.ts'
import { addMissingRequiredChecks, latencyStatus, watchlistProcessingStatus } from '../src/utils/status/monitorPolicy.ts'

describe('production monitor notification transitions', () => {
    test('current status bypasses slow history and retains verified evidence through restart and failure', async () => {
        const child = Bun.spawn([process.execPath, 'scripts/check-status-feed.ts'], { stdout: 'pipe', stderr: 'pipe' })
        const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect({ exitCode, stderr: exitCode ? stderr : '' }).toEqual({ exitCode: 0, stderr: '' })
        expect(stdout).toContain('persisted evidence survives restart and database failure')
    })

    test('latency-derived failure does not retain a success message', async () => {
        const recorded: Array<{ status: string, message: string }> = []
        await check(
            'threat-intelligence',
            'Public search',
            async () => 'A canonical threat-intelligence search completed successfully.',
            { degraded: 0, down: 0 },
            async (_service, _checkName, status, _latency, message) => { recorded.push({ status, message }) },
        )
        expect(recorded[0]?.status).toBe('down')
        expect(recorded[0]?.message).toMatch(/^Response took \d+ ms\.$/)
        expect(recorded[0]?.message).not.toContain('completed successfully')
    })

    test.each(['up', 'degraded', 'down'] as const)('recording failure preserves the %s probe result and fails the monitor job', async status => {
        const recorded: Array<{ status: string, message: string }> = []
        const persistenceError = new Error('timeout exceeded when trying to connect')
        await expect(check(
            'website', 'Public website',
            async () => ({ status, message: 'Original check result' }),
            undefined,
            async (_service, _name, recordedStatus, _latency, message) => {
                recorded.push({ status: recordedStatus, message })
                throw persistenceError
            },
        )).rejects.toBe(persistenceError)
        expect(recorded).toEqual([{ status, message: 'Original check result' }])
    })

    test('a failed probe is recorded once even if persistence also fails', async () => {
        const recorded: Array<{ status: string, message: string }> = []
        await expect(check(
            'website', 'Public website',
            async () => { throw new Error('Website returned HTTP 503.') },
            undefined,
            async (_service, _name, status, _latency, message) => {
                recorded.push({ status, message })
                throw new Error('Database unavailable')
            },
        )).rejects.toThrow('Database unavailable')
        expect(recorded).toEqual([{ status: 'down', message: 'Website returned HTTP 503.' }])
    })

    test('unavailable dependency records down promptly without substituting success', async () => {
        const originalFetch = globalThis.fetch
        const recorded: Array<{ status: string, message: string }> = []
        globalThis.fetch = ((_, init) => new Promise<Response>((_resolve, reject) => {
            const fail = () => reject(new Error('backend unavailable'))
            if (init?.signal?.aborted) fail()
            else init?.signal?.addEventListener('abort', fail, { once: true })
        })) as typeof fetch
        const started = performance.now()
        try {
            await check(
                'threat-intelligence',
                'Source operations',
                () => fetchJson('/v1/intel/source-operations', {}, 'http://unavailable.test', 5),
                undefined,
                async (_service, _checkName, status, _latency, message) => { recorded.push({ status, message }) },
            )
        } finally {
            globalThis.fetch = originalFetch
        }
        expect(performance.now() - started).toBeLessThan(1_000)
        expect(recorded).toEqual([{ status: 'down', message: 'backend unavailable' }])
    })

    test('explicit failure details and fast success messages are preserved', async () => {
        const recorded: Array<{ status: string, message: string }> = []
        const recorder = async (_service: string, _name: string, status: string, _latency: number, message: string) => { recorded.push({ status, message }) }
        await check('core', 'Dependency', async () => ({ status: 'degraded', message: 'Queue is behind' }), { degraded: 0, down: 0 }, recorder)
        await check('core', 'Dependency', async () => 'Ready', { degraded: 10000, down: 20000 }, recorder)
        expect(recorded).toEqual([{ status: 'degraded', message: 'Queue is behind' }, { status: 'up', message: 'Ready' }])
    })

    test('latency thresholds change status at their configured boundaries', () => {
        const thresholds = { degraded: 3_000, down: 10_000 }
        expect(latencyStatus(2_999, thresholds)).toBe('up')
        expect(latencyStatus(3_000, thresholds)).toBe('degraded')
        expect(latencyStatus(10_000, thresholds)).toBe('down')
    })

    test('does not report overall health without the required latest-activity check', () => {
        const checks = addMissingRequiredChecks([
            { service: 'core', check_name: 'API Health', status: 'up' as const },
        ], new Date('2026-08-08T23:48:00.000Z'))
        const latestActivity = checks.find(check => check.service === 'dark-web-monitoring' && check.check_name === 'Latest activity')
        expect(latestActivity).toMatchObject({
            status: 'down',
            message: 'No persisted monitor result is available for this required check.',
        })
    })

    test('does not report watchlist processing up when the scraper is unavailable', () => {
        expect(watchlistProcessingStatus(14, 14, false)).toEqual({
            status: 'down',
            message: 'Customer watchlists are synchronized, but the scraper is unavailable for collection.',
        })
        expect(watchlistProcessingStatus(14, 13, true).status).toBe('degraded')
        expect(watchlistProcessingStatus(14, 14, true).status).toBe('up')
    })
})
