import { EventEmitter } from 'node:events'
import { afterEach, expect, mock, test } from 'bun:test'

let configuredTimeout = 0
const previousTimeout = process.env.DWM_WEBHOOK_TIMEOUT_MS

mock.module('node:dns/promises', () => ({
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
}))

mock.module('node:https', () => ({
    request: (_url: URL, _options: unknown, onResponse: (response: EventEmitter & { setEncoding(encoding: string): void }) => void) => {
        const request = Object.assign(new EventEmitter(), {
            setTimeout(timeout: number) {
                configuredTimeout = timeout
                return request
            },
            destroy(error: Error) {
                request.emit('error', error)
            },
            end() {
                const response = Object.assign(new EventEmitter(), { setEncoding() {} })
                onResponse(response)
                response.emit('data', 'accepted')
                response.emit('end')
            },
        })
        return request
    },
}))

const { postPublicWebhook } = await import('../src/utils/dwm/webhookTransport.ts')

afterEach(() => {
    if (previousTimeout === undefined) delete process.env.DWM_WEBHOOK_TIMEOUT_MS
    else process.env.DWM_WEBHOOK_TIMEOUT_MS = previousTimeout
    configuredTimeout = 0
})

test('uses the default timeout for invalid configuration and clamps valid values', async () => {
    for (const [value, expected] of [['invalid', 8000], ['0', 1000], ['45000', 30000], ['Infinity', 30000]] as const) {
        process.env.DWM_WEBHOOK_TIMEOUT_MS = value
        await postPublicWebhook('https://hooks.example.com/alerts', '{}')
        expect(configuredTimeout).toBe(expected)
    }
})
