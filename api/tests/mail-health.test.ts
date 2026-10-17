import { EventEmitter } from 'node:events'
import { afterAll, expect, mock, test } from 'bun:test'
import type { MailHealth } from '../src/utils/mail/types.ts'

const records: Record<string, string[]> = {
    'example.test': ['v=spf1 include:mail.example.test -all'],
    '_dmarc.example.test': ['v=DMARC1; p=reject'],
    '_mta-sts.example.test': ['v=STSv1; id=1'],
    '_smtp._tls.example.test': ['v=TLSRPTv1; rua=mailto:tls@example.test'],
}
const resolverApi = {
    resolveNs: async () => ['ns.example.test'],
    resolve4: async () => ['192.0.2.53'],
}

class Resolver {
    setServers() {}
    async resolve4(name: string) { return name === 'mail.example.test' ? ['192.0.2.10'] : [] }
    async reverse() { return ['mail.example.test.'] }
    async resolveTxt(name: string) { return (records[name] || []).map(record => [record]) }
}

mock.module('node:dns/promises', () => ({ ...resolverApi, default: { ...resolverApi, Resolver }, Resolver }))
mock.module('node:net', () => {
    const api = { createConnection: () => {
        const socket = Object.assign(new EventEmitter(), { setTimeout() {}, destroy() {} })
        queueMicrotask(() => socket.emit('data', '220 mail.example.test ready'))
        return socket
    } }
    return { ...api, default: api }
})
mock.module('node:tls', () => {
    const api = { connect: (_options: unknown, onSecure: () => void) => {
        const socket = Object.assign(new EventEmitter(), {
            setTimeout() {}, destroy() {}, end() {},
            getPeerCertificate: () => ({ valid_to: new Date(Date.now() + 30 * 86_400_000).toUTCString(), subject: { CN: 'mail.example.test' } }),
        })
        queueMicrotask(onSecure)
        return socket
    } }
    return { ...api, default: api }
})
mock.module('../src/utils/mail/config.ts', () => ({ mailConfig: {
    host: 'mail.example.test', domain: 'example.test', internalUrl: 'http://mail-internal:8081', imapPort: 993,
} }))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({ fetchMailQueueSummary: async () => ({ data: { total: 0 } }) }))

const originalFetch = globalThis.fetch
globalThis.fetch = (async () => new Response('version: STSv1\nmode: enforce\nmx: mail.example.test\n', { status: 200 })) as typeof fetch
const { getMailHealth } = await import('../src/utils/mail/health.ts')

afterAll(() => { globalThis.fetch = originalFetch })

test('mail health aggregates DNS, policy, SMTP, TLS, and queue probes', async () => {
    const health: MailHealth = await getMailHealth()
    expect(health.status).toBe('healthy')
    expect(health.queueDepth).toBe(0)
    expect(health.smtpBannerLatencyMs).toBeNumber()
    expect(health.checks.map(({ id, status }) => [id, status])).toEqual([
        ['ptr', 'healthy'], ['spf', 'healthy'], ['dmarc', 'healthy'], ['mta-sts', 'healthy'],
        ['tlsrpt', 'healthy'], ['smtp-banner', 'healthy'], ['tls-cert', 'healthy'], ['queue', 'healthy'],
    ])
    expect(health.checks.find(check => check.id === 'tls-cert')?.detail).toContain('mail.example.test expires in')
})
