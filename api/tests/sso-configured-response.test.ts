import { afterAll, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import Fastify from 'fastify'
import { signState } from '../src/utils/auth/ssoOidc.ts'

const userRow = {
    id: 'sso-user',
    name: 'SSO User',
    avatar: null,
    active: true,
    deactivated_at: '2026-10-15T12:00:00.000Z',
    deletion_scheduled_at: null,
}
const databaseQueries: string[] = []
mock.module('#db', () => ({
    default: async (sql: string) => {
        databaseQueries.push(sql)
        return { rows: [userRow] }
    },
}))

const configKeys = [
    'SSO_OIDC_ENABLED',
    'SSO_OIDC_CLIENT_ID',
    'SSO_OIDC_CLIENT_SECRET',
    'SSO_OIDC_AUTHORIZATION_URL',
    'SSO_OIDC_TOKEN_URL',
    'SSO_OIDC_USERINFO_URL',
    'SSO_OIDC_REDIRECT_URI',
    'SSO_STATE_SECRET',
]
const configEnvKeys = [...configKeys, 'SSO_OIDC_PROVIDER']
const originalConfig = new Map(configEnvKeys.map(key => [key, process.env[key]]))
const fetchMock = spyOn(globalThis, 'fetch')

const { getSsoStart, postSsoCallback } = await import('../src/handlers/auth/sso.ts')
const app = Fastify()
app.get('/auth/sso/start', getSsoStart)
app.post('/auth/sso/callback', postSsoCallback)

beforeEach(() => {
    for (const key of configEnvKeys) delete process.env[key]
    databaseQueries.length = 0
    fetchMock.mockReset()
})

test('SSO start returns the configuration error when OIDC settings are missing', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/sso/start' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
        error: 'SSO is not configured.',
        code: 'sso_not_configured',
        missing: configKeys,
    })
})

test('SSO callback returns the same configuration error before validating the request body', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/sso/callback', payload: {} })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
        error: 'SSO is not configured.',
        code: 'sso_not_configured',
        missing: configKeys,
    })
})

test('SSO callback rejects a deactivated account even when active is true', async () => {
    process.env.SSO_OIDC_ENABLED = 'true'
    process.env.SSO_OIDC_PROVIDER = 'test-provider'
    process.env.SSO_OIDC_CLIENT_ID = 'client-id'
    process.env.SSO_OIDC_CLIENT_SECRET = 'client-secret'
    process.env.SSO_OIDC_AUTHORIZATION_URL = 'https://id.example.test/authorize'
    process.env.SSO_OIDC_TOKEN_URL = 'https://id.example.test/token'
    process.env.SSO_OIDC_USERINFO_URL = 'https://id.example.test/userinfo'
    process.env.SSO_OIDC_REDIRECT_URI = 'https://app.example.test/callback'
    process.env.SSO_STATE_SECRET = 'test-state-secret'
    fetchMock.mockImplementation(async url => String(url).endsWith('/token')
        ? new Response(JSON.stringify({ access_token: 'access-token' }), { status: 200 })
        : new Response(JSON.stringify({ sub: 'subject-1', email: 'user@example.test', email_verified: true }), { status: 200 }))

    const state = signState({
        provider: 'test-provider',
        redirectPath: '/dashboard',
        nonce: 'nonce',
        expiresAt: Date.now() + 60_000,
    }, 'test-state-secret')
    const response = await app.inject({
        method: 'POST',
        url: '/auth/sso/callback',
        payload: { code: 'authorization-code', state },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'This account is not active.', code: 'sso_account_inactive' })
    expect(databaseQueries[0]).toContain('u.deactivated_at')
    expect(fetchMock).toHaveBeenCalledTimes(2)
})

afterAll(async () => {
    await app.close()
    fetchMock.mockRestore()
    for (const [key, value] of originalConfig) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})
