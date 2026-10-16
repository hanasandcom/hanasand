import { expect, test } from 'bun:test'
import { responseErrorMessage } from '../src/utils/vms/fetch/metrics/responseErrorMessage'

test('uses JSON error then message fields in telemetry error responses', async () => {
    expect(await responseErrorMessage(Response.json({ error: 'unavailable', message: 'ignored' }, { status: 502 }), 'Docker telemetry'))
        .toBe('Docker telemetry returned 502: unavailable')
    expect(await responseErrorMessage(Response.json({ error: 7, message: 'try again' }, { status: 503 }), 'System telemetry'))
        .toBe('System telemetry returned 503: try again')
})

test('trims and caps plain text and handles empty or unreadable response bodies', async () => {
    const longBody = `  ${'x'.repeat(305)}  `
    expect(await responseErrorMessage(new Response(longBody, { status: 500 }), 'System telemetry'))
        .toBe(`System telemetry returned 500: ${'x'.repeat(300)}`)
    expect(await responseErrorMessage(new Response('', { status: 502 }), 'Docker telemetry'))
        .toBe('Docker telemetry returned 502.')
    const unreadable = { status: 504, text: () => Promise.reject(new Error('read failed')) } as Response
    expect(await responseErrorMessage(unreadable, 'Docker telemetry')).toBe('Docker telemetry returned 504.')
})
