import { expect, test } from 'bun:test'
import { providerCaptureMessage } from '../src/handlers/onionSession/providerCapture.ts'
import { providerStartUrl } from '../src/handlers/onionSession/providerNavigation.ts'
import { parseUrlQueryScores, urlQueryReportMatchesTarget } from '../src/handlers/onionSession/providerUrlResponses.ts'

test('current URLQuery report pages expose their detector counts in the submitted URL section', () => {
    const target = 'http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion/'
    const report = `Submitted URL\n${target}\nDetections\nURLQuery\n0\nIDS\n0\nTDS\n2`

    expect(urlQueryReportMatchesTarget(report, target)).toBe(true)
    expect(parseUrlQueryScores(report)).toEqual({ alerts: 2 })
})

test('URLQuery searches preserve the onion URL scheme used by the submitted URL', () => {
    const http = 'http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion/'
    const https = 'https://p53lf57qbcph367w7g4i57ctv7hlfssgmqb6e6g3m7654g6wb27w36yd.onion/'

    expect(providerStartUrl({ name: 'urlquery' }, 'https://urlquery.net/', http))
        .toBe(`https://urlquery.net/search/reports?q=${encodeURIComponent(http)}`)
    expect(providerStartUrl({ name: 'urlquery' }, 'https://urlquery.net/', https))
        .toBe(`https://urlquery.net/search/reports?q=${encodeURIComponent(https)}`)
})

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
