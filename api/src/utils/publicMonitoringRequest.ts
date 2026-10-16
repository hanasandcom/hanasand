import { lookup } from 'node:dns/promises'
import { request as httpRequest, type RequestOptions, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import type { Readable, Transform } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import ipaddr from 'ipaddr.js'

type Address = { address: string, family: number }
const MAX_RESPONSE_BODY_BYTES = 1_048_576
const MAX_CONTENT_ENCODINGS = 8
export type MonitoringResolver = (hostname: string, options: { all: true, verbatim: true }) => Promise<Address[]>
const blocked = () => new Error('Monitoring destinations must resolve only to public IP addresses.')

export function isPublicMonitoringAddress(value: string): boolean {
    if (!isIP(value)) return false
    const address = ipaddr.parse(value)
    if (address.range() !== 'unicast') return false
    if (address.kind() === 'ipv6') {
        // Permit global unicast only; exclude protocol assignments and documentation space.
        return address.match(ipaddr.parseCIDR('2000::/3'))
            && !address.match(ipaddr.parseCIDR('2001::/23'))
            && !address.match(ipaddr.parseCIDR('3fff::/20'))
    }
    return true
}

export function monitoringUrl(value: string | URL): URL {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Monitoring URLs must use HTTP or HTTPS without embedded credentials.')
    }
    return url
}

export async function resolveMonitoringAddresses(host: string, signal: AbortSignal, resolver: MonitoringResolver = lookup): Promise<Address[]> {
    signal.throwIfAborted()
    const hostname = host.replace(/^\[|\]$/g, '').toLowerCase()
    if (!hostname || hostname.includes('%') || /(^|\.)(localhost|local|internal)\.?$/.test(hostname)) throw blocked()
    const family = isIP(hostname)
    const addresses = family ? [{ address: hostname, family }] : await new Promise<Address[]>((resolve, reject) => {
        const abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        resolver(hostname, { all: true, verbatim: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
    signal.throwIfAborted()
    if (!addresses.length || addresses.some(item => !isPublicMonitoringAddress(item.address) || isIP(item.address) !== item.family)) throw blocked()
    return addresses
}

export function monitoringLookup(addresses: Address[]): LookupFunction {
    // Never fall back to DNS during connection establishment (including retries by the runtime).
    return (_hostname, options, callback) => {
        const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : Number(options.family || 0)
        const matching = addresses.filter(item => !family || item.family === family)
        if (!matching.length) return callback(Object.assign(blocked(), { code: 'ENOTFOUND' }), options.all ? [] : '', family)
        if (options.all) callback(null, matching)
        else callback(null, matching[0].address, matching[0].family)
    }
}

type MonitoringRequestOptions = {
    method?: 'GET' | 'POST'
    userAgent?: string | null
    headers?: Record<string, string>
    followRedirects: boolean
    timeoutMs: number
    readBody?: boolean
    signal?: AbortSignal
}
type Transport = (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ReturnType<typeof httpRequest>
const transport: Transport = (url, options, callback) => (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, options, callback)

export async function publicMonitoringRequest(value: string | URL, options: MonitoringRequestOptions, resolver: MonitoringResolver = lookup, send: Transport = transport) {
    let url = monitoringUrl(value)
    const controller = new AbortController()
    const externalSignal = options.signal
    const forwardAbort = () => controller.abort(externalSignal?.reason)
    if (externalSignal?.aborted) forwardAbort()
    else externalSignal?.addEventListener('abort', forwardAbort, { once: true })
    const timer = setTimeout(() => controller.abort(new DOMException('Monitoring request timed out.', 'TimeoutError')), options.timeoutMs)
    const { signal } = controller
    let method = options.method || 'GET'
    try {
        for (let redirects = 0; ; redirects++) {
            const addresses = await resolveMonitoringAddresses(url.hostname, signal, resolver)
            const result = await new Promise<{ status: number, statusText: string, location?: string, body: string }>((resolve, reject) => {
                const hasAcceptEncoding = Object.keys(options.headers || {}).some(header => header.toLowerCase() === 'accept-encoding')
                const headers = {
                    ...(!hasAcceptEncoding ? { 'accept-encoding': 'gzip, deflate, br' } : {}),
                    ...options.headers,
                    ...(options.userAgent ? { 'user-agent': options.userAgent } : {}),
                }
                let settled = false
                const activeRequest: { current?: ReturnType<Transport> } = {}
                let responseStream: IncomingMessage | undefined
                const decoders: Transform[] = []
                const fail = (error: Error, destroyRequest = true) => {
                    if (settled) return
                    settled = true
                    reject(error)
                    responseStream?.destroy()
                    for (const decoder of decoders) decoder.destroy()
                    if (destroyRequest && typeof activeRequest.current?.destroy === 'function') activeRequest.current.destroy(error)
                }
                activeRequest.current = send(url, {
                    method, agent: false, lookup: monitoringLookup(addresses), signal,
                    headers: Object.keys(headers).length ? headers : undefined,
                }, response => {
                    responseStream = response
                    const status = response.statusCode || 0
                    const statusText = response.statusMessage || ''
                    const location = response.headers.location
                    if (!options.readBody || options.followRedirects && location && [301, 302, 303, 307, 308].includes(status)) {
                        settled = true
                        resolve({ status, statusText, location, body: '' })
                        response.destroy()
                        return
                    }
                    let bodyStream: Readable = response
                    try {
                        const encodings = response.headers['content-encoding']?.split(',').map(encoding => encoding.trim().toLowerCase()).filter(Boolean) || []
                        if (encodings.length > MAX_CONTENT_ENCODINGS) throw new Error('Monitoring source exceeds the content-encoding layer limit.')
                        for (const encoding of encodings.reverse()) {
                            let decoder: Transform
                            if (encoding === 'gzip' || encoding === 'x-gzip') decoder = createGunzip()
                            else if (encoding === 'deflate') decoder = createInflate()
                            else if (encoding === 'br') decoder = createBrotliDecompress()
                            else if (encoding === 'identity') continue
                            else throw new Error(`Unsupported monitoring response encoding: ${encoding}.`)
                            decoders.push(decoder)
                            decoder.once('error', fail)
                            bodyStream = bodyStream.pipe(decoder)
                        }
                    } catch (error) {
                        const failure = error instanceof Error ? error : new Error(String(error))
                        fail(failure)
                        return
                    }
                    const chunks: Buffer[] = []
                    let encodedSize = 0
                    let decodedSize = 0
                    response.on('data', (chunk: Buffer) => {
                        encodedSize += chunk.length
                        if (encodedSize > MAX_RESPONSE_BODY_BYTES) {
                            fail(new Error('Monitoring source exceeds the 1 MiB encoded response limit.'))
                        }
                    })
                    bodyStream.on('data', (chunk: Buffer) => {
                        decodedSize += chunk.length
                        if (decodedSize > MAX_RESPONSE_BODY_BYTES) {
                            fail(new Error('Monitoring source exceeds the 1 MiB decoded response limit.'))
                        } else chunks.push(chunk)
                    })
                    response.once('error', fail)
                    response.once('aborted', () => fail(new Error('Monitoring response ended before the body was complete.')))
                    bodyStream.once('end', () => {
                        if (settled) return
                        settled = true
                        resolve({ status, statusText, location, body: Buffer.concat(chunks).toString('utf8') })
                    })
                })
                activeRequest.current.once('error', error => {
                    const failure = signal.aborted ? signal.reason : error
                    fail(failure instanceof Error ? failure : new Error(String(failure)), false)
                })
                activeRequest.current.end()
            })
            if (!options.followRedirects || !result.location || ![301, 302, 303, 307, 308].includes(result.status)) {
                return { ...result, ok: result.status >= 200 && result.status < 300, url: url.href }
            }
            if (redirects >= 10) throw new Error('Monitoring source exceeded the redirect limit.')
            url = monitoringUrl(new URL(result.location, url))
            if (result.status === 303 || method === 'POST' && [301, 302].includes(result.status)) method = 'GET'
        }
    } finally {
        clearTimeout(timer)
        externalSignal?.removeEventListener('abort', forwardAbort)
    }
}
