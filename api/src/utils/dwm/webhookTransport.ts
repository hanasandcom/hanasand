import crypto from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'

const DEFAULT_CONTROLLED_RECEIVER_URL = 'https://hanasand.com/api/dwm/webhook-sink'

type WebhookResolver = (hostname: string, options: { all: true, verbatim: true }) => Promise<Array<{ address: string, family: number }>>

export function normalizeWebhookUrl(raw: string) {
    let url
    try {
        url = new URL(raw)
    } catch {
        throw new Error('endpointUrl must be a valid URL.')
    }

    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('Webhook destinations must use HTTPS.')
    }
    if (privateWebhookTarget(url.hostname)) throw new Error('Webhook destinations must use a public network target.')

    return url.toString()
}

export function signDwmWebhookDeliveryBody(body: string, target: string, secret = process.env.TI_SCRAPER_SERVICE_TOKEN || '', timestamp = '') {
    return secret ? `sha256=${crypto.createHmac('sha256', secret).update(`${normalizeWebhookUrl(target)}\n${timestamp}\n${body}`).digest('hex')}` : ''
}

export async function assertPublicWebhookTarget(value: string, resolver: WebhookResolver = lookup) {
    return (await resolvePublicWebhookTarget(value, resolver)).normalized
}

async function resolvePublicWebhookTarget(value: string, resolver: WebhookResolver = lookup) {
    const normalized = normalizeWebhookUrl(value)
    const hostname = new URL(normalized).hostname.replace(/^\[|\]$/g, '')
    const addresses = await resolver(hostname, { all: true, verbatim: true })
    if (!addresses.length || addresses.some(item => privateWebhookTarget(item.address))) {
        throw new Error('Webhook destination resolved to a private network target.')
    }
    return { normalized, addresses }
}

export async function postPublicWebhook(endpoint: string, body: string, signingSecret = '') {
    const { normalized, addresses } = await resolvePublicWebhookTarget(endpoint)
    const url = new URL(normalized)
    const timeoutMs = Math.max(1000, Math.min(Number(process.env.DWM_WEBHOOK_TIMEOUT_MS || 8000), 30000))
    const signatureTimestamp = signingSecret ? new Date().toISOString() : ''
    const signature = signingSecret
        ? signDwmWebhookDeliveryBody(body, normalized, signingSecret, signatureTimestamp)
        : controlledReceiverUrls().includes(normalized)
            ? signDwmWebhookDeliveryBody(body, normalized)
            : ''
    let deliveryContext: Record<string, unknown> = {}
    let payloadContext: Record<string, unknown> = {}
    try {
        const payload = JSON.parse(body) as Record<string, unknown>
        payloadContext = recordOrEmpty(payload._hanasand)
        deliveryContext = recordOrEmpty(payloadContext.delivery)
    } catch {
        // The payload was already canonicalized and validated before sending.
    }

    return new Promise<{ status: number, body: string }>((resolve, reject) => {
        const request = httpsRequest(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(body),
                'user-agent': 'hanasand-dwm-webhooks/1.0',
                ...(signature ? { 'x-hanasand-delivery-signature': signature } : {}),
                ...(signingSecret ? {
                    'x-hanasand-signature-version': 'v1',
                    'x-hanasand-signature-timestamp': signatureTimestamp,
                    ...(typeof deliveryContext.id === 'string' ? { 'x-hanasand-delivery-id': deliveryContext.id } : {}),
                    ...(typeof payloadContext.idempotencyKey === 'string' ? { 'x-hanasand-idempotency-key': payloadContext.idempotencyKey } : {}),
                } : {}),
            },
            lookup: pinnedWebhookLookup(addresses),
        }, response => {
            response.setEncoding('utf8')
            let responseBody = ''
            response.on('data', chunk => {
                if (responseBody.length < 4096) responseBody += String(chunk).slice(0, 4096 - responseBody.length)
            })
            response.on('end', () => resolve({ status: response.statusCode ?? 0, body: responseBody }))
        })
        request.setTimeout(timeoutMs, () => request.destroy(new Error('Webhook request timed out.')))
        request.on('error', reject)
        request.end(body)
    })
}

export function controlledReceiverUrls() {
    return [...new Set(
        (process.env.DWM_CONTROLLED_RECEIVER_URLS || DEFAULT_CONTROLLED_RECEIVER_URL)
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
            .map(normalizeWebhookUrl)
    )]
}

export function controlledReceiverEndpointHashes() {
    return controlledReceiverUrls().map(url => hashValue('endpoint', url))
}

export function pinnedWebhookLookup(addresses: Array<{ address: string, family: number }>): LookupFunction {
    return (_hostname, options, callback) => {
        const requestedFamily = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : Number(options.family || 0)
        const matching = requestedFamily ? addresses.filter(item => item.family === requestedFamily) : addresses
        if (!matching.length) {
            const error = Object.assign(new Error('No validated webhook address matches the requested family.'), { code: 'ENOTFOUND' })
            callback(error, options.all ? [] : '', requestedFamily)
            return
        }
        if (options.all) {
            callback(null, matching)
            return
        }
        callback(null, matching[0].address, matching[0].family)
    }
}

function privateWebhookTarget(value: string): boolean {
    const hostname = value.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true
    if (isIP(hostname) === 4) {
        const [a, b] = hostname.split('.').map(Number)
        return a === 0
            || a === 10
            || a === 127
            || (a === 100 && b >= 64 && b <= 127)
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && (b === 0 || b === 168))
            || (a === 198 && (b === 18 || b === 19))
            || a >= 224
    }
    if (isIP(hostname) === 6) {
        if (hostname === '::' || hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || /^fe[89abcf]/.test(hostname) || hostname.startsWith('ff')) return true
        const mapped = ipv4FromMappedIpv6(hostname)
        return mapped ? privateWebhookTarget(mapped) : hostname.startsWith('::')
    }
    return false
}

function ipv4FromMappedIpv6(value: string): string | null {
    const suffix = value.match(/^::ffff:(.+)$/)?.[1]
    if (!suffix) return null
    if (isIP(suffix) === 4) return suffix
    const groups = suffix.split(':')
    if (groups.length !== 2 || groups.some(group => !/^[0-9a-f]{1,4}$/.test(group))) return null
    const bytes = groups.flatMap(group => {
        const number = Number.parseInt(group, 16)
        return [number >> 8, number & 255]
    })
    return bytes.join('.')
}

export function hashValue(scope: string, value: string) {
    return `${scope}_${crypto.createHash('sha256').update(value).digest('hex').slice(0, 32)}`
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}
