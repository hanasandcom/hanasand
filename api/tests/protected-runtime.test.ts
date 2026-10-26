import { expect, test } from 'bun:test'
import { isProtectedLogsRuntime } from '../src/utils/docker/protectedRuntime.ts'

test('protects current and legacy Logs containers by name or Compose identity', () => {
    for (const name of ['logs_api', 'logs-worker-1', '/processor-api-1', 'hanasand-log-collector']) {
        expect(isProtectedLogsRuntime(name)).toBe(true)
    }
    expect(isProtectedLogsRuntime('api-1', 'logs', 'api')).toBe(true)
    expect(isProtectedLogsRuntime('api-1', 'processor', 'api')).toBe(true)
    expect(isProtectedLogsRuntime('api-1', 'other', 'logs_worker')).toBe(true)
})

test('does not protect unrelated containers with incidental log wording', () => {
    expect(isProtectedLogsRuntime('catalog-api-1', 'catalog', 'api')).toBe(false)
    expect(isProtectedLogsRuntime('applogs-api-1', 'application', 'api')).toBe(false)
})
