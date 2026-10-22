import { expect, test } from 'bun:test'
import { providerCaptureMessage } from '../src/handlers/onionSession/providerCapture.ts'
import { createProviderProfileCaptureService } from '../src/handlers/onionSession/providerProfileCapture.ts'
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

test('provider startup failures produce same-report captures instead of disappearing', async () => {
    const messages: Array<Record<string, unknown>> = []
    const capture = createProviderProfileCaptureService({
        sessionId: 'session-1',
        isCurrentRun: () => true,
        send: message => messages.push(message),
        webCrackTasks: async () => [],
        newProviderPage: async () => { throw new Error('provider browser could not launch') },
        watchConsole: () => undefined,
        maybeExtendSuspiciousRun: () => undefined,
        persistProviderRunResult: () => undefined,
    })

    await capture([
        { id: 'virustotal', name: 'VirusTotal', url: 'https://www.virustotal.com/gui/search/{url}' },
        { id: 'urlquery', name: 'urlquery', url: 'https://urlquery.net/search?q={url}' },
    ], 'https://example.com/', [], 1, 'run-1')

    expect(messages.filter(message => message.type === 'tool_capture')).toHaveLength(2)
    expect(messages.map(message => message.error)).toEqual([
        'Provider browser could not start: provider browser could not launch',
        'Provider browser could not start: provider browser could not launch',
    ])
})
