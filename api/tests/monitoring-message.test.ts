import { expect, test } from 'bun:test'
import { readableMonitoringMessage } from '../src/utils/monitoringMessage.ts'
import { monitoringCaseResolution } from '../src/utils/monitoringCaseWorkflow.ts'

const recovery = 'JSON check passed: ok = true; alert ne true (first).'
test('existing JSON recovery notes read naturally without changing stored evidence', () => {
    const resolution = { type: 'automation', note: recovery, id: 'run-one' }
    expect(monitoringCaseResolution({ resolution })).toEqual({ ...resolution, note: 'The service reports that it is healthy.' })
    expect(resolution.note).toBe(recovery)
    expect(monitoringCaseResolution({ resolution: { ...resolution, type: 'human' } })?.note).toBe(recovery)
    expect(monitoringCaseResolution({ resolution: { ...resolution, type: 'ai' } })?.note).toBe(recovery)
})
test('unhealthy and inverted results never become a healthy success', () => {
    expect(readableMonitoringMessage('JSON threshold exceeded: ok = false; alert ne true (first).')).toBe('The check failed. The service reports that it is unhealthy.')
    expect(readableMonitoringMessage('JSON threshold exceeded: ok = true; alert ne true (first).')).toBe('The check failed. The service reports that it is healthy.')
    expect(readableMonitoringMessage('JSON check passed: ok = false; alert ne true (first).')).toContain('The check passed.')
})
test('field readings explain the configured threshold and next check', () => {
    for (const [aggregate, label] of [['max', 'maximum'], ['min', 'minimum'], ['avg', 'average'], ['first', 'current']]) {
        expect(readableMonitoringMessage(`JSON threshold exceeded: samples.*.temperature = 81.25; alert gt 80 (${aggregate}).`, { monitorName: 'Room temperature' })).toBe(`Room temperature reports ${label} temperature at 81.25, above the configured alert value of 80. Check the monitor’s data source and target.`)
    }
    expect(readableMonitoringMessage('JSON check passed: status = ready; alert ne ready (first).', { monitorName: 'API status' })).toBe('API status is within its configured limit: current status is ready.')
})
test('boolean alert conditions say what the monitor reported', () => {
    expect(readableMonitoringMessage('JSON threshold exceeded: current.alert = true; alert eq true (first).', { monitorName: 'Logs throughput' }))
        .toBe('Logs throughput reports an active alert. Review the latest check result and the affected component’s status.')
})
test('system checks describe known conditions and actions', () => {
    expect(readableMonitoringMessage('JSON threshold exceeded: collection.critical = true; alert eq true (first).', { monitorName: 'TI Collection', targetUrl: 'system:ti-collection' }))
        .toContain('no completed run is recorded within the five-minute freshness window')
    expect(readableMonitoringMessage('JSON threshold exceeded: summary.needsReportCount = 12; alert gt 10 (first).', { monitorName: 'TI delivery', targetUrl: 'system:ti-delivery' }))
        .toBe('TI delivery has 12 retained incidents waiting for a first report, above the alert limit of 10. Review the timeliness dashboard and report backlog.')
})
test('HTTP errors name the monitor and suggest a relevant check', () => {
    expect(readableMonitoringMessage('JSON source returned HTTP 503.', { monitorName: 'Model health' })).toBe('Model health returned HTTP 503 in its health check. Check the endpoint and required dependencies.')
    expect(readableMonitoringMessage('JSON source returned HTTP 401.', { monitorName: 'Model health' })).toBe('Model health was rejected with HTTP 401. Check the monitor’s authentication and route permissions.')
    for (const message of ['ETIMEDOUT', 'RAM usage is normal: 8% used (alert at 80%).', 'A person wrote JSON check passed in a comment.']) expect(readableMonitoringMessage(message)).toBe(message)
})
