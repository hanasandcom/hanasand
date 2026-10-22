import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { logsProxyTimeoutMs } from '../src/utils/logs/proxyTimeout'

test('only exact Errors GET permits the bounded cold summary to finish', () => {
    expect(logsProxyTimeoutMs('GET', ['logs', 'errors'], 12_000)).toBe(45_000)
    expect(logsProxyTimeoutMs('GET', ['logs', 'errors'], 60_000)).toBe(60_000)
    for (const method of ['POST', 'DELETE', 'HEAD']) expect(logsProxyTimeoutMs(method, ['logs', 'errors'], 12_000)).toBeNull()
    for (const path of [['logs', 'search'], ['logs', 'errors', 'extra'], ['logs'], ['errors'], ['logs', 'errors-other']]) expect(logsProxyTimeoutMs('GET', path, 12_000)).toBeNull()
    const route = readFileSync(new URL('../src/app/api/backend/[...path]/route.ts', import.meta.url), 'utf8')
    expect(route).toContain('logsProxyTimeoutMs(req.method, pathSegments, BACKEND_PROXY_TIMEOUT_MS)')
})

test('the website distinguishes an unavailable historical count and preserves checked timestamp', () => {
    const source = readFileSync(new URL('../src/app/dashboard/logs/pageClient.tsx', import.meta.url), 'utf8')
    expect(source).toContain('skipped_events_available === false')
    expect(source).toContain('skipped_events_checked_at')
    expect(source).not.toContain('!!data?.processing?.skipped_events')
})
