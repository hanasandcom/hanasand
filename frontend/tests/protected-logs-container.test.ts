import { expect, test } from 'bun:test'
import { isProtectedLogsContainer } from '../src/app/dashboard/system/client/protectedLogsContainer.ts'

test('hides restart controls for current and legacy Logs containers', () => {
    for (const name of ['logs_api', 'logs-worker-1', 'processor-api-1', 'hanasand-log-collector']) {
        expect(isProtectedLogsContainer(name)).toBe(true)
    }
})

test('keeps restart controls for unrelated containers', () => {
    expect(isProtectedLogsContainer('catalog-api-1')).toBe(false)
    expect(isProtectedLogsContainer('applogs-api-1')).toBe(false)
})
