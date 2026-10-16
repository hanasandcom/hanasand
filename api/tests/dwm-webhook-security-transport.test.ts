import { describe, expect, test } from 'bun:test'
import { assertPublicWebhookTarget, normalizeDwmWebhookDestinationInput, pinnedWebhookLookup, redactWebhookEndpoint, sanitizeDwmWebhookDeliveryDiagnostic, signDwmWebhookDeliveryBody } from '../src/utils/dwm/webhooks.ts'

describe('DWM webhook transport and destination security', () => {
    test('keeps target and signing secrets out of serialized destination normalization', () => {
        const endpointUrl = 'https://discord.com/api/webhooks/987654321/customer-path-secret'
        const signingSecret = 'delivery-signing-secret'
        const normalized = normalizeDwmWebhookDestinationInput({ endpointUrl, signingSecret }, 'owner')

        expect(normalized.endpointUrl).toBe(endpointUrl)
        expect(normalized.signingSecret).toBe(signingSecret)
        expect(normalized.endpointEncrypted).toBeTruthy()
        expect(normalized.endpointEncrypted).not.toContain(endpointUrl)
        expect(normalized.endpointEncrypted).not.toContain('customer-path-secret')
        expect({ ...normalized }).not.toHaveProperty('endpointUrl')
        expect({ ...normalized }).not.toHaveProperty('signingSecret')
        const serialized = JSON.stringify(normalized)
        expect(serialized).not.toContain('customer-path-secret')
        expect(serialized).not.toContain(signingSecret)

        const endpointDescriptor = Object.getOwnPropertyDescriptor(normalized, 'endpointUrl')
        expect(endpointDescriptor).toMatchObject({ enumerable: false, writable: true, configurable: true })
    })

    test('generates a sufficiently long signing secret when one is omitted', () => {
        const normalized = normalizeDwmWebhookDestinationInput({ endpointUrl: 'https://receiver.example/dwm' }, 'owner')

        expect(normalized.signingSecret).toBeTruthy()
        expect(normalized.signingSecret!.length).toBeGreaterThanOrEqual(32)
    })

    test('matches the fixed webhook signature vector and binds the timestamp', () => {
        const endpoint = 'https://receiver.example/dwm'
        const body = '{"event":"alert"}'
        const secret = 'receiver-signing-secret'
        const timestamp = '2026-08-08T08:00:00.000Z'

        const signature = signDwmWebhookDeliveryBody(body, endpoint, secret, timestamp)

        expect(signature).toBe('sha256=8f43618f0bfcc7a880b47b8eefca66ba345170ae575ae4d94f590cbcd0dfeccc')
        expect(signDwmWebhookDeliveryBody(body, endpoint, secret, '2026-08-08T08:00:01.000Z')).not.toBe(signature)
    })

    test('preserves Discord webhook ids while redacting endpoint and diagnostic secrets', () => {
        expect(redactWebhookEndpoint('https://discord.com/api/webhooks/1234567890/discord-path-secret'))
            .toBe('https://discord.com/api/webhooks/1234567890/...')

        const diagnostic = sanitizeDwmWebhookDeliveryDiagnostic(
            'Discord rejected https://discord.com/api/webhooks/1234567890/discord-path-secret?token=query-secret token=credential-secret',
        )

        expect(diagnostic).toContain('https://discord.com/api/webhooks/1234567890/...')
        expect(diagnostic).toContain('[credential redacted]')
        expect(diagnostic).not.toContain('discord-path-secret')
        expect(diagnostic).not.toContain('query-secret')
        expect(diagnostic).not.toContain('credential-secret')
    })

    test('rejects local and private literal destinations before encryption', () => {
        for (const endpointUrl of [
            'https://localhost/hook',
            'https://127.0.0.1/hook',
            'https://10.0.0.1/hook',
            'https://169.254.169.254/latest/meta-data',
            'https://[::1]/hook',
            'https://[::ffff:7f00:1]/hook',
            'https://user:pass@example.com/hook',
        ]) {
            expect(() => normalizeDwmWebhookDestinationInput({ endpointUrl }, 'owner')).toThrow()
        }
    })

    test('rejects malformed and non-HTTPS destination URLs', () => {
        expect(() => normalizeDwmWebhookDestinationInput({ endpointUrl: 'not a URL' }, 'owner'))
            .toThrow('endpointUrl must be a valid URL.')
        expect(() => normalizeDwmWebhookDestinationInput({ endpointUrl: 'http://receiver.example/hook' }, 'owner'))
            .toThrow('Webhook destinations must use HTTPS.')
    })

    test('rejects private DNS answers and accepts a public pinned target', async () => {
        const privateResolver = async () => [{ address: '10.0.0.2', family: 4 }]
        const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }]

        await expect(assertPublicWebhookTarget('https://hooks.example.com/alerts', privateResolver)).rejects.toThrow('private network')
        await expect(assertPublicWebhookTarget('https://hooks.example.com/alerts', publicResolver)).resolves.toBe('https://hooks.example.com/alerts')
    })

    test('returns pinned addresses in the shape requested by Node HTTPS', async () => {
        const pinned = pinnedWebhookLookup([
            { address: '2001:db8::10', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ])
        const all = await new Promise<unknown>((resolve, reject) => pinned('hooks.example.com', { all: true }, (error, result) => error ? reject(error) : resolve(result)))
        const ipv4 = await new Promise<unknown>((resolve, reject) => pinned('hooks.example.com', { family: 4 }, (error, result) => error ? reject(error) : resolve(result)))

        expect(all).toEqual([
            { address: '2001:db8::10', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ])
        expect(ipv4).toBe('93.184.216.34')
    })
})
