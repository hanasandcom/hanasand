import { expect, mock, test } from 'bun:test'

mock.module('#constants', () => ({ default: { vm_api_token: 'server-only-key' } }))

const { hasTrustedServerSession } = await import('../src/utils/auth/deviceProofRequest.ts')

const request = (overrides: Record<string, string> = {}) => ({
    headers: {
        'x-hanasand-server-session-validated': '1',
        'x-hanasand-server-session-id': 'user-a',
        'x-hanasand-server-session-token': 'session-token-a',
        'x-hanasand-server-session-assertion': 'server-only-key',
        ...overrides,
    },
}) as never

test('trusted server session requires the server secret and exact user session', () => {
    expect(hasTrustedServerSession(request(), 'user-a', 'session-token-a')).toBe(true)
    expect(hasTrustedServerSession(request({ 'x-hanasand-server-session-id': 'user-b' }), 'user-a', 'session-token-a')).toBe(false)
    expect(hasTrustedServerSession(request({ 'x-hanasand-server-session-token': 'other-token' }), 'user-a', 'session-token-a')).toBe(false)
    expect(hasTrustedServerSession(request({ 'x-hanasand-server-session-assertion': 'wrong-key' }), 'user-a', 'session-token-a')).toBe(false)
    expect(hasTrustedServerSession(request({ 'x-hanasand-server-session-validated': '0' }), 'user-a', 'session-token-a')).toBe(false)
})
