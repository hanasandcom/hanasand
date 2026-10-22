// @ts-expect-error Bun supplies this test module at runtime.
import { expect, test } from 'bun:test'
import { publicStatusLabel, publicStatusMessage } from '../src/utils/status/publicStatusCopy'

test('public status labels hide internal names while keeping readable service names', () => {
    expect(publicStatusLabel('auth')).toBe('Account access')
    expect(publicStatusLabel('threat-intelligence')).toBe('Threat Intelligence')
    expect(publicStatusLabel('api')).toBe('API')
    expect(publicStatusLabel('prod_rate_limit')).toBe('Rate limits')
})

test('public incident messages group duplicate service baselines', () => {
    const cases = [
        ['No share page 4xx/5xx responses in the recent log window.', 'Normal workspace link traffic baseline.'],
        ['No share page availability responses in the recent log window.', 'Normal workspace link traffic baseline.'],
        ['No websocket failures in the recent log window.', 'Normal realtime delivery traffic baseline.'],
        ['No realtime delivery failures in the recent log window.', 'Normal realtime delivery traffic baseline.'],
        ['No terminal failures in the recent log window.', 'Normal workspace session traffic baseline.'],
        ['No workspace session issues in the recent log window.', 'Normal workspace session traffic baseline.'],
        ['No VM provisioning errors in the recent log window.', 'Normal workspace runtime traffic baseline.'],
        ['No workspace runtime errors in the recent log window.', 'Normal workspace runtime traffic baseline.'],
    ] as const
    for (const [source, expected] of cases) expect(publicStatusMessage(source)).toBe(expected)
})
