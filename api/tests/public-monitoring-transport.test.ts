import { expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { createServer, request as httpRequest } from 'node:http'
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { monitoringLookup, publicMonitoringRequest, resolveMonitoringAddresses } from '../src/utils/publicMonitoringRequest.ts'
import { options, resolver, mockSend, type Send } from './public-monitoring-request-fixture.ts'

test('external cancellation tears down a stacked decoder after compressed bytes arrive', async () => {
    const controller = new AbortController()
    const encoded = brotliCompressSync(gzipSync('x'.repeat(100_000)))
    let requestDestroyed = false
    let responseDestroyed = false
    const send: Send = (_url, requestOptions, callback) => {
        const request = new EventEmitter() as ReturnType<Send>
        const response = Object.assign(new PassThrough(), { statusCode: 200, headers: { 'content-encoding': 'gzip, br' } })
        response.once('data', () => controller.abort())
        request.destroy = (error?: Error) => {
            requestDestroyed = true
            if (error) request.emit('error', error)
            response.destroy()
            responseDestroyed = response.destroyed
            return request
        }
        request.end = (() => {
            queueMicrotask(() => {
                callback(response as Parameters<Parameters<Send>[2]>[0])
                response.write(encoded.subarray(0, 20))
                setTimeout(() => response.end(encoded.subarray(20)), 20)
            })
            return request
        }) as typeof request.end
        requestOptions.signal?.addEventListener('abort', () => request.destroy(new Error('aborted')), { once: true })
        return request
    }

    await expect(publicMonitoringRequest('http://example.com', { ...options, signal: controller.signal }, resolver, send)).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestDestroyed).toBe(true)
    expect(responseDestroyed).toBe(true)
})
test('deadline covers DNS and response body', async () => {
    const slow = mockSend([])
    await expect(publicMonitoringRequest('http://example.com', { ...options, timeoutMs: 20 }, () => new Promise(() => {}), slow.send)).rejects.toThrow('timed out')
    expect(slow.calls).toHaveLength(0)
    const body = mockSend([{ hang: true }])
    await expect(publicMonitoringRequest('http://example.com', { ...options, timeoutMs: 20 }, resolver, body.send)).rejects.toThrow('timed out')
})
test('external cancellation aborts an in-flight request', async () => {
    const controller = new AbortController()
    const { send, calls } = mockSend([{ hang: true }])
    const pending = publicMonitoringRequest('http://example.com', { ...options, signal: controller.signal }, resolver, send)
    await new Promise(resolve => setTimeout(resolve, 0))
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls[0]?.options.signal?.aborted).toBe(true)
})
test('Bun native transport uses the supplied pinned lookup and retains Host', async () => {
    // Test the transport against an isolated loopback fixture; production resolution rejects this address.
    const server = createServer((req, res) => res.end(req.headers.host))
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    try {
        const result = await new Promise<string>((resolve, reject) => {
            const req = httpRequest(`http://does-not-resolve.invalid:${port}/`, { agent: false, lookup: monitoringLookup([{ address: '127.0.0.1', family: 4 }]) }, res => {
                let body = ''
                res.on('data', chunk => body += chunk)
                res.on('end', () => resolve(body))
            })
            req.setTimeout(1000, () => req.destroy(new Error('pinning failed')))
            req.on('error', reject)
            req.end()
        })
        expect(result).toBe(`does-not-resolve.invalid:${port}`)
    } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
test('certificate and socket resolution reject private destinations before opening a socket', async () => {
    await expect(resolveMonitoringAddresses('127.0.0.1', AbortSignal.timeout(100))).rejects.toThrow('public IP')
    await expect(resolveMonitoringAddresses('::1', AbortSignal.timeout(100))).rejects.toThrow('public IP')
})
test('native HTTPS pinning preserves SNI and certificate hostname verification', async () => {
    const { createServer, request } = await import('node:https')
    const { readFile } = await import('node:fs/promises')
    const fixture = new URL('./fixtures/monitoring-tls/', import.meta.url)
    let server: ReturnType<typeof createServer> | undefined
    try {
        // Public test-only key and certificate; never used by a deployed service.
        const cert = await readFile(new URL('cert.txt', fixture))
        server = createServer({ key: await readFile(new URL('key.txt', fixture)), cert }, (req, res) => res.end(req.headers.host))
        await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
        const port = (server.address() as { port: number }).port
        const fetchFixture = (hostname: string, trusted: boolean) => new Promise<string>((resolve, reject) => {
            const req = request(`https://${hostname}:${port}/`, { agent: false, ca: trusted ? cert : undefined, lookup: monitoringLookup([{ address: '127.0.0.1', family: 4 }]) }, res => {
                let body = ''
                res.on('data', chunk => body += chunk)
                res.on('end', () => resolve(body))
            })
            req.setTimeout(1000, () => req.destroy(new Error('TLS fixture timed out')))
            req.on('error', reject)
            req.end()
        })
        expect(await fetchFixture('monitor.invalid', true)).toBe(`monitor.invalid:${port}`)
        await expect(fetchFixture('wrong.invalid', true)).rejects.toThrow()
        await expect(fetchFixture('monitor.invalid', false)).rejects.toThrow()
    } finally {
        if (server) await new Promise<void>(resolve => server!.close(() => resolve()))
    }
})
test('an expired deadline retains TimeoutError when Bun reports ECONNREFUSED on abort', async () => {
    const send: Send = (_url, opts) => {
        const request = new EventEmitter() as ReturnType<Send>
        request.end = (() => request) as typeof request.end
        opts.signal!.addEventListener('abort', () => request.emit('error', Object.assign(new Error('connect ECONNREFUSED example.com:443'), { code: 'ECONNREFUSED' })), { once: true })
        return request
    }
    await expect(publicMonitoringRequest('https://example.com', { ...options, timeoutMs: 10 }, resolver, send)).rejects.toMatchObject({ name: 'TimeoutError' })
})
test('negotiates, decodes standard HTTP response encodings, and bounds encoded and decoded bodies', async () => {
    const body = '{"ok":true}'
    for (const [encoding, encodedBody] of [
        ['gzip', gzipSync(body)],
        ['deflate', deflateSync(body)],
        ['br', brotliCompressSync(body)],
        ['gzip, br', brotliCompressSync(gzipSync(body))],
    ] as const) {
        const { send, calls } = mockSend([{ encoding, body: encodedBody }])
        expect((await publicMonitoringRequest('http://example.com', options, resolver, send)).body).toBe(body)
        expect(calls[0]?.options.headers).toMatchObject({ 'accept-encoding': 'gzip, deflate, br' })
    }

    const oversized = mockSend([{ encoding: 'gzip', body: gzipSync('x'.repeat(1_048_577)) }])
    await expect(publicMonitoringRequest('http://example.com', options, resolver, oversized.send)).rejects.toThrow('1 MiB decoded')

    const encodedMembers = Buffer.concat(Array.from({ length: 55_000 }, () => gzipSync('x')))
    expect(encodedMembers.length).toBeGreaterThan(1_048_576)
    const oversizedEncoded = mockSend([{ encoding: 'gzip', body: encodedMembers }])
    await expect(publicMonitoringRequest('http://example.com', options, resolver, oversizedEncoded.send)).rejects.toThrow('1 MiB encoded')

    const malformed = mockSend([{ encoding: 'gzip', body: gzipSync(body).subarray(0, -4) }])
    await expect(publicMonitoringRequest('http://example.com', options, resolver, malformed.send)).rejects.toThrow()

    const malformedStack = mockSend([{ encoding: 'gzip, br', body: brotliCompressSync(gzipSync(body).subarray(0, -4)) }])
    await expect(publicMonitoringRequest('http://example.com', options, resolver, malformedStack.send)).rejects.toThrow()

    const unsupportedAfterDecoder = mockSend([{ encoding: 'unsupported, gzip', body: gzipSync(body) }])
    await expect(publicMonitoringRequest('http://example.com', options, resolver, unsupportedAfterDecoder.send)).rejects.toThrow('Unsupported monitoring response encoding')

    const excessiveLayers = mockSend([{ encoding: Array(9).fill('identity').join(', '), body }])
    await expect(publicMonitoringRequest('http://example.com', options, resolver, excessiveLayers.send)).rejects.toThrow('content-encoding layer limit')

    const pending = mockSend([{ encoding: 'gzip', hang: true }])
    await expect(publicMonitoringRequest('http://example.com', { ...options, timeoutMs: 20 }, resolver, pending.send)).rejects.toThrow('timed out')
})
