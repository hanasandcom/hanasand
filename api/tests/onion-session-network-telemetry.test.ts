import { expect, test } from 'bun:test'
import { BrowserRunNetworkTelemetry, type SandboxNetworkEvent } from '../src/handlers/onionSession/networkTelemetry.ts'

function request(index: number): SandboxNetworkEvent {
    return {
        kind: 'request',
        url: `https://host-${index}.example/path`,
        method: 'GET',
        at: new Date(index).toISOString(),
    }
}

test('network telemetry retains recent events while preserving run totals and domain count', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    for (let index = 0; index <= 600; index++) telemetry.record(request(index))
    telemetry.site = { url: 'https://host-600.example/path', ip: '203.0.113.10' }

    const summary = telemetry.summary()

    expect(summary.requestCount).toBe(601)
    expect(summary.uniqueDomainCount).toBe(601)
    expect(summary.uniqueDomainCountTruncated).toBe(false)
    expect(summary.eventHistoryTruncated).toBe(true)
    expect(summary.domains).toHaveLength(80)
    expect(summary.domainsTruncated).toBe(true)
    expect(summary.domains).not.toContain('host-0.example')
    expect(summary.domains).toContain('host-80.example')
    expect(summary.recentRequests).toHaveLength(60)
    expect(summary.recentRequests[0]?.url).toBe('https://host-541.example/path')
    expect(telemetry.requestStartedAt('https://host-600.example/path', 'GET')).toBe(new Date(600).toISOString())
    expect(telemetry.requestStartedAt('https://host-0.example/path', 'GET')).toBeUndefined()
    expect(summary.site).toEqual({ url: 'https://host-600.example/path', ip: '203.0.113.10' })
})

test('network telemetry reset clears per-run counters, history, domains, and site peer', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    telemetry.record(request(1))
    telemetry.site = { url: 'https://host-1.example/path', ip: '203.0.113.10' }

    telemetry.reset()

    expect(telemetry.summary()).toMatchObject({
        requestCount: 0,
        responseCount: 0,
        failedCount: 0,
        uniqueDomainCount: 0,
        domains: [],
        recentRequests: [],
        eventHistoryTruncated: false,
        site: undefined,
    })
})

test('network telemetry evicts old events to keep the serialized history within its byte budget', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    const path = 'é'.repeat(8 * 1024)
    const urls = Array.from({ length: 200 }, (_, index) => `https://long.example/${path}/${index}`)
    for (let index = 0; index < urls.length; index++) {
        telemetry.record({ kind: 'request', url: urls[index]!, method: 'GET', at: new Date(index).toISOString() })
    }

    const summary = telemetry.summary()

    expect(summary.requestCount).toBe(200)
    expect(summary.eventHistoryTruncated).toBe(true)
    expect(telemetry.requestStartedAt(urls[0]!, 'GET')).toBeUndefined()
    expect(telemetry.requestStartedAt(urls.at(-1)!, 'GET')).toBe(new Date(199).toISOString())
})

test('network telemetry caps retained unique domains and marks the reported count as truncated', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    for (let index = 0; index <= 4096; index++) telemetry.record(request(index))

    expect(telemetry.summary()).toMatchObject({
        uniqueDomainCount: 4096,
        uniqueDomainCountTruncated: true,
    })
    telemetry.reset()
    expect(telemetry.summary()).toMatchObject({ uniqueDomainCount: 0, uniqueDomainCountTruncated: false })
})

test('network telemetry does not retain one oversized contacted domain', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    const label = 'a'.repeat(60)
    const host = Array(35_000).fill(label).join('.')
    telemetry.record({ kind: 'request', url: `https://${host}/`, method: 'GET', at: new Date(0).toISOString() })

    expect(telemetry.summary()).toMatchObject({
        uniqueDomainCount: 0,
        uniqueDomainCountTruncated: true,
        domains: [],
        domainsTruncated: true,
    })
})

test('network telemetry skips repeated single events larger than the history byte budget', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    const url = `https://large.example/${'x'.repeat(2 * 1024 * 1024)}`
    for (let index = 0; index < 3; index++) {
        telemetry.record({ kind: 'request', url, method: 'GET', at: new Date(index).toISOString() })
    }

    expect(telemetry.summary()).toMatchObject({
        requestCount: 3,
        uniqueDomainCount: 1,
        uniqueDomainCountTruncated: false,
        eventHistoryTruncated: true,
        recentRequests: [],
    })
    expect(telemetry.requestStartedAt(url, 'GET')).toBeUndefined()
})

test('network telemetry includes the retained site URL in its aggregate history budget', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    const url = `https://request.example/${'a'.repeat(1_250_000)}`
    telemetry.record({ kind: 'request', url, method: 'GET', at: new Date(0).toISOString() })

    telemetry.site = { url: `https://site.example/${'b'.repeat(1_000_000)}`, ip: '203.0.113.10' }

    expect(telemetry.summary()).toMatchObject({
        eventHistoryTruncated: true,
        domainsTruncated: true,
        site: { ip: '203.0.113.10' },
        recentRequests: [],
    })
    expect(telemetry.requestStartedAt(url, 'GET')).toBeUndefined()
})

test('network telemetry clears a previous site when an oversized replacement cannot be retained', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    telemetry.site = { url: 'https://old.example/', ip: '203.0.113.10' }

    telemetry.site = { url: `https://large.example/${'x'.repeat(2 * 1024 * 1024)}`, ip: '203.0.113.20' }

    expect(telemetry.summary()).toMatchObject({ eventHistoryTruncated: true, site: undefined })
})

test('network telemetry excludes oversized download records from its bounded history', () => {
    const telemetry = new BrowserRunNetworkTelemetry()
    const url = `https://large.example/${'x'.repeat(2 * 1024 * 1024)}`

    expect(telemetry.record({ kind: 'download', url, fileName: 'sample.bin', at: new Date(0).toISOString() })).toBe(false)
    const file = { kind: 'download', url: 'https://small.example/file', fileName: 'file.bin', at: new Date(1).toISOString() } satisfies SandboxNetworkEvent
    expect(telemetry.record(file)).toBe(true)
    file.fileName = 'x'.repeat(2 * 1024 * 1024)
    expect(telemetry.refresh(file)).toBe(false)
    expect(telemetry.summary()).toMatchObject({
        eventHistoryTruncated: true,
        domainsTruncated: true,
        uniqueDomainCount: 0,
        downloads: [],
    })
})
