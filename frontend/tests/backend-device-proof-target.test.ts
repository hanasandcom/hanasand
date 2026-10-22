import { expect, test } from 'bun:test'
import { backendDeviceProofTarget } from '../src/utils/auth/backendDeviceProofTarget'

function request(headers: Record<string, string> = {}, method = 'GET') {
    return { url: 'https://localhost:3000/api/backend/ai/workspace?view=all', method, headers: new Headers(headers) }
}

test('keeps the configured public target across the standalone loopback hop', () => {
    expect(backendDeviceProofTarget(request())).toEqual({ url: 'https://hanasand.com/api/backend/ai/workspace', method: 'GET' })
})
test('preserves the native proof target and actual request method', () => {
    expect(backendDeviceProofTarget(request({ 'x-device-proof-url': 'https://hanasand.com/api/backend/ai/workspace', 'x-device-proof-method': 'PUT' }, 'PUT')))
        .toEqual({ url: 'https://hanasand.com/api/backend/ai/workspace', method: 'PUT' })
})
test('ignores untrusted forwarded host and protocol', () => {
    expect(backendDeviceProofTarget(request({ host: 'evil.test', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'http' })))
        .toEqual({ url: 'https://hanasand.com/api/backend/ai/workspace', method: 'GET' })
})
for (const target of [
    'http://hanasand.com/api/backend/ai/workspace',
    'https://evil.test/api/backend/ai/workspace',
    'https://hanasand.com.evil.test/api/backend/ai/workspace',
    'https://user@hanasand.com/api/backend/ai/workspace',
    'https://hanasand.com/api/backend/ai/models',
    'https://hanasand.com/api/backend/ai/workspace?view=all',
    'https://hanasand.com/api/backend/ai/workspace#fragment',
    'not a URL',
]) test(`rejects a mismatched supplied proof URL: ${target}`, () => {
    expect(backendDeviceProofTarget(request({ 'x-device-proof-url': target }))).toBeNull()
})
test('rejects a supplied method that differs from the real request', () => {
    expect(backendDeviceProofTarget(request({ 'x-device-proof-method': 'POST' }))).toBeNull()
})
test('supports an explicitly configured isolated HTTPS staging origin', () => {
    expect(backendDeviceProofTarget(request(), 'https://127.0.0.1:3456')).toEqual({ url: 'https://127.0.0.1:3456/api/backend/ai/workspace', method: 'GET' })
})
for (const origin of ['http://hanasand.com', 'https://user:password@hanasand.com', 'https://hanasand.com/other', 'invalid']) {
    test(`rejects unsafe public origin configuration: ${origin}`, () => {
        expect(backendDeviceProofTarget(request(), origin)).toBeNull()
    })
}

test('preserves encoded path segments without decoding or changing their scope', () => {
    const value = request({ 'x-device-proof-url': 'https://hanasand.com/api/backend/ai/conversations/name%2Fpart' })
    value.url = 'http://localhost:3000/api/backend/ai/conversations/name%2Fpart?view=all'
    expect(backendDeviceProofTarget(value)?.url).toBe('https://hanasand.com/api/backend/ai/conversations/name%2Fpart')
})
test('retains a trailing slash in the exact requested pathname', () => {
    const value = request({ 'x-device-proof-url': 'https://hanasand.com/api/backend/ai/workspace/' })
    value.url = 'http://localhost:3000/api/backend/ai/workspace/'
    expect(backendDeviceProofTarget(value)?.url).toBe('https://hanasand.com/api/backend/ai/workspace/')
})
