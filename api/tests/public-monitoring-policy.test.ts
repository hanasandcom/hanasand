import { expect, test } from 'bun:test'
import { isPublicMonitoringAddress, monitoringUrl, publicMonitoringRequest } from '../src/utils/publicMonitoringRequest.ts'
import { options, publicAddresses, resolver, mockSend } from './public-monitoring-request-fixture.ts'

test('only public IPv4 and global IPv6 destinations are accepted', () => {
    for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '192.0.0.1', '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1', 'fe80::1', 'fc00::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '64:ff9b::a00:1', '2002:0a00:0001::1', '2001:db8::1', '3fff::1', '5f00::1', 'invalid']) {
        expect(isPublicMonitoringAddress(address)).toBe(false)
    }
    for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) expect(isPublicMonitoringAddress(address)).toBe(true)
})
test('rejects private literals including URL-normalized numeric forms without connecting', async () => {
    const { send, calls } = mockSend([])
    for (const url of ['http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://[::ffff:7f00:1]', 'http://localhost.', 'http://service.local']) {
        await expect(publicMonitoringRequest(url, options, resolver, send)).rejects.toThrow('public IP')
    }
    expect(calls).toHaveLength(0)
    for (const url of ['ftp://example.com', 'http://user:pass@example.com']) expect(() => monitoringUrl(url)).toThrow()
})
test('rejects empty, mixed public/private, and invalid DNS answers', async () => {
    for (const addresses of [[], [...publicAddresses, { address: '10.0.0.1', family: 4 }], [{ address: '8.8.8.8', family: 6 }]]) {
        const { send, calls } = mockSend([])
        await expect(publicMonitoringRequest('https://example.com', options, async () => addresses, send)).rejects.toThrow('public IP')
        expect(calls).toHaveLength(0)
    }
})
test('pins validated answers without a second DNS lookup and preserves hostname and method', async () => {
    let resolutions = 0
    const { send, calls } = mockSend([{}])
    await publicMonitoringRequest('https://arbitrary.example:8443/path', { ...options, method: 'POST', userAgent: 'monitor-test' }, async () => ++resolutions === 1 ? publicAddresses : [{ address: '127.0.0.1', family: 4 }], send)
    const call = calls[0]
    expect(call.url.hostname).toBe('arbitrary.example')
    expect(call.options.agent).toBe(false)
    expect(call.options.method).toBe('POST')
    expect(call.options.headers).toEqual({ 'accept-encoding': 'gzip, deflate, br', 'user-agent': 'monitor-test' })
    for (let i = 0; i < 2; i++) call.options.lookup!('arbitrary.example', { all: true }, (error, addresses) => { expect(error).toBeNull(); expect(addresses).toEqual(publicAddresses) })
    expect(resolutions).toBe(1)
})
test('validates every redirect, including same-host DNS rebinding', async () => {
    for (const location of ['http://10.0.0.1/private', 'http://[::1]/', 'file:///etc/passwd', 'https://user:pass@example.com']) {
        const { send, calls } = mockSend([{ status: 302, location }])
        await expect(publicMonitoringRequest('https://example.com', options, resolver, send)).rejects.toThrow()
        expect(calls).toHaveLength(1)
    }
    let resolutions = 0
    const { send, calls } = mockSend([{ status: 302, location: '/next' }])
    await expect(publicMonitoringRequest('https://example.com', options, async () => ++resolutions === 1 ? publicAddresses : [{ address: '10.0.0.1', family: 4 }], send)).rejects.toThrow('public IP')
    expect(calls).toHaveLength(1)
})
test('allows public relative and cross-host redirects and preserves Fetch POST redirect semantics', async () => {
    const { send, calls } = mockSend([{ status: 307, location: '/next' }, { status: 303, location: 'https://other.example/final' }, {}])
    const response = await publicMonitoringRequest('http://example.com', { ...options, method: 'POST' }, resolver, send)
    expect(JSON.parse(response.body)).toEqual({ ok: true })
    expect(calls.map(call => call.options.method)).toEqual(['POST', 'POST', 'GET'])
    expect(calls.map(call => call.url.hostname)).toEqual(['example.com', 'example.com', 'other.example'])
})
test('returns final response metadata after redirects', async () => {
    const { send } = mockSend([{ status: 302, location: '/final' }, { status: 204, statusText: 'No Content' }])
    const response = await publicMonitoringRequest('http://example.com/start', options, resolver, send)

    expect(response).toMatchObject({ status: 204, statusText: 'No Content', ok: true, url: 'http://example.com/final' })
})
test('manual redirects do not connect to the Location target', async () => {
    const { send, calls } = mockSend([{ status: 302, location: 'http://10.0.0.1/' }])
    expect((await publicMonitoringRequest('http://example.com', { ...options, followRedirects: false }, resolver, send)).status).toBe(302)
    expect(calls).toHaveLength(1)
})
test('bounds redirects and response sizes', async () => {
    const loop = mockSend(Array.from({ length: 12 }, () => ({ status: 302, location: '/again' })))
    await expect(publicMonitoringRequest('http://example.com', options, resolver, loop.send)).rejects.toThrow('redirect limit')
    expect(loop.calls).toHaveLength(11)
    const large = mockSend([{ body: 'x'.repeat(1_048_577) }])
    await expect(publicMonitoringRequest('http://example.com', options, resolver, large.send)).rejects.toThrow('1 MiB')
})
