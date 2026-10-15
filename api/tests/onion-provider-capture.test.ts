import { expect, test } from 'bun:test'
import { providerCaptureMessage } from '../src/handlers/onionSession/providerCapture.ts'

test('provider captures share the websocket envelope while preserving stage-specific fields', () => {
    const capturedAt = '2026-10-15T12:00:00.000Z'
    const evidence = { verdict: 'unknown' }
    const message = providerCaptureMessage('session-1', {
        id: 'provider-1',
        name: 'Provider',
        url: 'https://provider.example/report',
        capturedAt,
        target: 'https://target.example',
    }, {
        title: 'Report',
        image: null,
        evidence,
        error: 'provider_navigation_pending',
    })

    expect(message).toEqual({
        type: 'tool_capture',
        sessionId: 'session-1',
        id: 'provider-1',
        name: 'Provider',
        url: 'https://provider.example/report',
        capturedAt,
        target: 'https://target.example',
        title: 'Report',
        image: null,
        evidence,
        error: 'provider_navigation_pending',
    })
    expect(JSON.parse(JSON.stringify(providerCaptureMessage('session-1', {
        id: 'provider-1', name: 'Provider', url: 'https://provider.example/report', capturedAt, target: 'https://target.example',
    }, { error: undefined })))).not.toHaveProperty('error')
})
